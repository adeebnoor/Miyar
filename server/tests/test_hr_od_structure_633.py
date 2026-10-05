import io
from server.taxonomy import Catalog, read_rows, bulk_diagnosis


def fixture_rows():
    return [
        {'positionId':'CEO','parentPositionId':'','grade':'G10','title':'Software Engineer','occupationCode':'251204','directReports':'3','budgetAmount':'10000','authority':'All'},
        {'positionId':'CHILD','parentPositionId':'CEO','grade':'G10','title':'Accountant','occupationCode':'251204','directReports':'−3','budgetAmount':'90000000','authority':'All'},
        {'positionId':'BROKEN','parentPositionId':'MISSING','grade':'G03','title':'','occupationCode':'251204','directReports':'0','budgetAmount':'invalid','authority':'recommend'},
        {'positionId':'CYCLE-A','parentPositionId':'CYCLE-B','grade':'G03','title':'Software Engineer','occupationCode':'251204','directReports':'0','budgetAmount':'1000','authority':'recommend'},
        {'positionId':'CYCLE-B','parentPositionId':'CYCLE-A','grade':'G02','title':'Software Engineer','occupationCode':'251204','directReports':'0','budgetAmount':'1000','authority':'recommend'},
    ]


def test_structure_layers_and_bilingual_mismatch_are_separate_from_unknown_titles():
    report=bulk_diagnosis(fixture_rows(),Catalog())
    assert report['totalRows']==5 and report['validRows']==4
    assert report['rows'][0]['titleCodeStatus']=='matched'
    assert report['rows'][1]['titleCodeStatus']=='inconsistent'
    assert report['rowErrors']==[{'row':4,'field':'title','code':'missing_title'}]
    assert report['hierarchy']['layers']==2
    assert report['hierarchy']['missingParents']==[4]
    assert report['hierarchy']['cycleRows']==[5,6]
    assert any(row['positionId']=='CHILD' for row in report['hierarchy']['gradeInversions'])
    assert {'invalid_direct_reports','absolute_authority','budget_outlier','grade_inversion'}<=set(report['rows'][1]['flags'])


def test_xlsx_preserves_partial_rows_and_hierarchy_columns():
    from openpyxl import Workbook
    workbook=Workbook();sheet=workbook.active
    headers=['positionId','parentPositionId','grade','title','occupationCode','directReports','budgetAmount','authority']
    sheet.append(headers)
    for row in fixture_rows():sheet.append([row.get(key,'') for key in headers])
    target=io.BytesIO();workbook.save(target)
    parsed=read_rows(target.getvalue(),'positions.xlsx')
    report=bulk_diagnosis(parsed,Catalog())
    assert parsed[1]['parentPositionId']=='CEO' and parsed[1]['grade']=='G10'
    assert report['rowErrors'][0]['row']==4
    assert report['hierarchy']['layers']==2
    assert report['rows'][0]['titleCodeAligned'] is True


def test_duplicate_ids_and_missing_parents_are_visible_and_not_counted_as_valid_layers():
    rows=[{'positionId':'A','parentPositionId':'','title':'Software Engineer','occupationCode':'251204'}, {'positionId':'A','parentPositionId':'ABSENT','title':'Software Engineer','occupationCode':'251204'}]
    report=bulk_diagnosis(rows,Catalog())
    assert all('duplicate_position_id' in row['flags'] for row in report['rows'])
    assert report['hierarchy']['layers']==0


def test_maximum_reporting_chain_does_not_depend_on_python_recursion_limit():
    rows=[{'positionId':f'P{i}','parentPositionId':f'P{i-1}' if i else '', 'title':f'Position {i}','grade':'G01'} for i in range(10000)]
    report=bulk_diagnosis(rows,Catalog())
    assert report['hierarchy']['layers']==10000
    assert report['rows'][-1]['layer']==10000
