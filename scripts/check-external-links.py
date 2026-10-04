"""Read-only external reference checks; third-party denials are reported, never bypassed."""
import concurrent.futures,json,re,time,urllib.request,urllib.error
from pathlib import Path
from html import unescape


def collect_urls(directory=Path('dist')):
    urls=set()
    for file in directory.rglob('*'):
        if file.suffix not in ['.js','.html','.json'] or file.name.startswith('miyar-'):continue
        source=file.read_text()
        if file.suffix=='.json':
            def visit(value):
                if isinstance(value,dict):
                    for key,item in value.items():
                        if key in ['sourceUrl','url'] and isinstance(item,str) and item.startswith('https://'):urls.add(item)
                        else:visit(item)
                elif isinstance(value,list):
                    for item in value:visit(item)
            try:visit(json.loads(source))
            except json.JSONDecodeError:pass
        else:
            urls.update(unescape(u) for u in re.findall(r'href=["\'](https://[^"\'<>]+)["\']',source))
            # Data-backed links are rendered dynamically, including licensing and HR guides.
            urls.update(unescape(u) for u in re.findall(r'\bsource\s*:\s*["\'](https://[^"\'<>]+)["\']',source))
    return {u for u in urls if 'example' not in u and '+esc' not in u}


def attempt(url, timeout):
    started=time.monotonic()
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Miyar-Reference-Check/6.1.3'})
        with urllib.request.urlopen(req,timeout=timeout) as response:
            response.read(1024)
            return {'url':url,'status':response.status,'finalUrl':response.url,'result':'reachable','seconds':round(time.monotonic()-started,2)}
    except urllib.error.HTTPError as error:
        return {'url':url,'status':error.code,'reason':type(error).__name__,'result':'broken' if error.code in [404,410] else 'not-confirmed','seconds':round(time.monotonic()-started,2)}
    except Exception as error:
        return {'url':url,'result':'not-confirmed','reason':type(error).__name__,'seconds':round(time.monotonic()-started,2)}


def check(url, timeout=30):
    started=time.monotonic()
    attempts=[]
    for _ in range(2):
        result=attempt(url,timeout)
        attempts.append(result)
        transient=500 <= result.get('status',0) < 600 or result.get('reason') in ['TimeoutError','URLError']
        if result['result']=='reachable' or not transient:break
    return {**attempts[-1],'seconds':round(time.monotonic()-started,2),'attempts':attempts}


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(check,sorted(collect_urls())))
    output={'scope':'Literal source reference links, including archived reports; GET only, no credentials or bypass. Thirty-second timeout per attempt; at most one retry for network timeout/URLError or HTTP 5xx only. HTTP 403, 404 and 410 are never retried. Every attempt is recorded. Reachability does not establish source currency or regulatory validity.','checked':len(results),'results':results}
    Path('test-results').mkdir(exist_ok=True)
    Path('test-results/external-reference-check.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
    print(json.dumps({'checked':len(results),'reachable':sum(r['result']=='reachable' for r in results),'broken':[r for r in results if r['result']=='broken'],'notConfirmed':[r for r in results if r['result']=='not-confirmed']},ensure_ascii=False))


if __name__=='__main__':main()
