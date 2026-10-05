from server.taxonomy import Catalog,read_rows
from server.semantic_scope import read_role_catalog


def test_unified_catalog_translations_distinguish_matching_inconsistent_and_unknown():
    catalog=Catalog()
    assert catalog.match_title_code('Software Engineer','251204')['status']=='matched'
    assert catalog.match_title_code('مهندسة برمجيات','251204')['status']=='matched'
    mismatch=catalog.match_title_code('Accountant','251204')
    assert mismatch['status']=='inconsistent'
    assert mismatch['expectedCodes']==['241101']
    assert catalog.match_title_code('Unknown synthetic role','251204')['status']=='unknown'
    for role in read_role_catalog()['roles']:
        assert catalog.match_title_code(role['titleEn'],role['ssco'])['status']=='matched',role['titleEn']


def test_directory_search_uses_the_same_shared_english_translation_source():
    catalog=Catalog()
    for title,code in [('Software Engineer','251204'),('Accountant','241101'),('Cleaner','911201'),('Car Driver','832201'),('Secondary Mathematics Teacher','233010'),('Business Intelligence Analyst','242102'),('Data Analyst','212002')]:
        output=catalog.search(title)
        assert output['items'][0]['code']==code,title
        assert output['items'][0]['translationStatus']=='proposed-search-translation'


def test_partial_rows_preserve_casefolded_hierarchy_headers_and_the_missing_title_row():
    rows=read_rows(b'POSITIONID;TITLE;OCCUPATIONCODE;PARENTPOSITIONID;GRADE\np1;Software Engineer;251204;;G07\np2;;251204;p1;G06','positions.csv')
    assert len(rows)==2
    assert rows[0]['positionId']=='p1'
    assert rows[1]['parentPositionId']=='p1'
    assert rows[1]['grade']=='G06'
    assert rows[1]['title']==''
    assert rows[1]['__row']==3
