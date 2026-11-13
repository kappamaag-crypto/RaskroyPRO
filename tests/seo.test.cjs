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

test('single real page in sitemap',()=>{
  assert.equal((sitemap.match(/<loc>/g)||[]).length,1);
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