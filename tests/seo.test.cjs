'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const robots = fs.readFileSync(path.join(root,'robots.txt'),'utf8');
const sitemap = fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const canonical = 'https://raskroy.spk-effa.ru/';

test('search metadata and canonical hostname are consistent',()=>{
  assert.match(html,/<html lang="ru">/);
  assert.ok(html.includes('<link rel="canonical" href="'+canonical+'">'));
  assert.match(html,/<title>Раскрой PRO — онлайн-калькулятор/);
  assert.match(html,/<meta name="description" content="[^"]{90,180}"/);
  assert.match(html,/<script type="application\/ld\+json">/);
  assert.match(html,/rel="icon" href="\/favicon.png"/);
  assert.doesNotMatch(html,/<meta[^>]+noindex/);
});

test('five real pages in sitemap',()=>{
  assert.equal((sitemap.match(/<loc>/g)||[]).length,5);
  assert.ok(sitemap.includes('<loc>'+canonical+'</loc>'));
  assert.match(sitemap,/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test('robots permits crawling and links canonical sitemap',()=>{
  assert.match(robots,/User-agent: \*/);
  assert.match(robots,/Allow: \//);
  assert.ok(robots.includes('Sitemap: '+canonical+'sitemap.xml'));
  assert.doesNotMatch(robots,/Disallow:\s*\//);
});

test('website favicon files are valid and present',()=>{
  for(const filename of ['favicon.png','favicon.ico','favicon.svg']){
    assert.ok(fs.statSync(path.join(root,filename)).size>100,filename);
  }
  const png=fs.readFileSync(path.join(root,'favicon.png'));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),96);
  assert.equal(png.readUInt32BE(20),96);
});
test('SEO content pages are internally linked and indexable',()=>{
  const slugs=['instrukciya','primer-raskroya','algoritmy','uchet-ostatkov'];
  assert.match(html,/<h1>Онлайн-калькулятор раскроя металлопроката — Раскрой PRO<\/h1>/);
  for(const slug of slugs){
    const filename=slug+'.html';
    const page=fs.readFileSync(path.join(root,filename),'utf8');
    assert.ok(html.includes('href="/'+filename+'"'),filename);
    assert.ok(sitemap.includes('<loc>'+canonical+filename+'</loc>'),filename);
    assert.ok(page.includes('<link rel="canonical" href="'+canonical+filename+'">'),filename);
    assert.equal((page.match(/<h1\b/g)||[]).length,1,filename);
    assert.match(page,/<meta name="description" content="[^"]+"/);
    assert.doesNotMatch(page,/<meta[^>]+noindex/);
    assert.ok(page.includes('href="/"'),filename);
  }
});

test('internal links on all SEO pages resolve to files',()=>{
  for(const filename of ['index.html','instrukciya.html','primer-raskroya.html','algoritmy.html','uchet-ostatkov.html']){
    const page=fs.readFileSync(path.join(root,filename),'utf8');
    for(const [,url] of page.matchAll(/href="(\/[^"#?]+\.html)"/g)){
      assert.ok(fs.existsSync(path.join(root,url.slice(1))),filename+': '+url);
    }
  }
});
