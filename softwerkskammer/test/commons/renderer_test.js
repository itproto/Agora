'use strict';
const expect = require('must-dist');

require('../../testutil/configureForTest');
const Renderer = require('simple-configure').get('beans').get('renderer');

describe('Renderer', () => {
  describe('should render bracket tags', () => {

    it('1', () => {
      const text = 'a [[Foo]] b';
      expect(Renderer.render(text, 'subdir')).to.equal('<p>a <a class="internal" href="/wiki/subdir/foo">Foo</a> b</p>\n');
    });

    it('2', () => {
      const text = 'a [[Foo]][[Foo]][[Foo]] b';
      expect(Renderer.render(text, 'subdir')).to.be.equal('<p>a <a class="internal" href="/wiki/subdir/foo">Foo</a><a class="internal" href="/wiki/subdir/foo">Foo</a><a class="internal" href="/wiki/subdir/foo">Foo</a> b</p>\n');
    });

    it('3', () => {
      const text = 'a [[Foo Bar]] b';
      expect(Renderer.render(text, 'subdir')).to.be.equal('<p>a <a class="internal" href="/wiki/subdir/foo-bar">Foo Bar</a> b</p>\n');
    });

    it('4', () => {
      const text = 'a [[Foo]][[Bar]] b';
      expect(Renderer.render(text, 'subdir')).to.be.equal('<p>a <a class="internal" href="/wiki/subdir/foo">Foo</a><a class="internal" href="/wiki/subdir/bar">Bar</a> b</p>\n');
    });

    it('5', () => {
      const text = 'a [[Foo]] [[Bar]] b';
      expect(Renderer.render(text, 'subdir')).to.be.equal('<p>a <a class="internal" href="/wiki/subdir/foo">Foo</a> <a class="internal" href="/wiki/subdir/bar">Bar</a> b</p>\n');
    });

    it('6', () => {
      const text = 'a [[Il marito di Foo|Foobar]] [[Bar]] b';
      expect(Renderer.render(text, 'subdir')).to.be.equal('<p>a <a class="internal" href="/wiki/subdir/foobar">Il marito di Foo</a> <a class="internal" href="/wiki/subdir/bar">Bar</a> b</p>\n');
    });

    it('7', () => {
      const text = 'a [[Foo / Bar]] b';
      expect(Renderer.render(text, 'subdir')).to.be.equal('<p>a <a class="internal" href="/wiki/subdir/foo---bar">Foo / Bar</a> b</p>\n');
    });
  });

  it('should normalize a string', () => {
    expect(Renderer.normalize('34')).to.equal('34');
    expect(Renderer.normalize('    ')).to.equal('');
    expect(Renderer.normalize('')).to.equal('');
    expect(Renderer.normalize('hello_Sidebar')).to.equal('hello_sidebar');
    expect(Renderer.normalize('_Sidebar')).to.equal('_sidebar');
    expect(Renderer.normalize('_FOOTER')).to.equal('_footer');
    expect(Renderer.normalize('CoffeE')).to.equal('coffee');
    expect(Renderer.normalize('nell"aria')).to.equal('nellaria');
    expect(Renderer.normalize('lento  lento   lentissimo')).to.equal('lento--lento---lentissimo');
    expect(Renderer.normalize('nell - aria')).to.equal('nell---aria');
    expect(Renderer.normalize(' nell - ariä ')).to.equal('nell---aria');
    expect(Renderer.normalize('Caffé')).to.equal('caffe');
    expect(Renderer.normalize('Caffè corretto!')).to.equal('caffe-corretto');
    expect(Renderer.normalize('äöüß')).to.equal('aous');
    expect(Renderer.normalize('ÄÖÜ')).to.equal('aou');
    expect(Renderer.normalize('Caff<p>e</p> senza schiuma')).to.equal('caffpe-p-senza-schiuma');
    expect(Renderer.normalize('Per favore: nessun, dico; E un punto...')).to.equal('per-favore-nessun-dico-e-un-punto');
  });

  it('should render source code', () => {
    expect(Renderer.render('```javascript \n ```')).to.match(/class="lang-javascript"/);
  });

  it('should render source code even if language not found, instead of crashing', () => {
    expect(Renderer.render('```unknown \n ```')).to.match(/class="lang-unknown"/);
  });

  it('splits a text into header and remainder if "header" is paragraph', () => {
    const result = Renderer.titleAndRenderedTail('Hallo\n\nDresden');
    expect(result).to.have.property('title', 'Hallo');
    expect(result).to.have.property('body', '<p>Dresden</p>\n');
  });

  it('splits a text into header and remainder if header is really header', () => {
    const result = Renderer.titleAndRenderedTail('## Hallo\n\nDresden');
    expect(result).to.have.property('title', 'Hallo');
    expect(result).to.have.property('body', '<p>Dresden</p>\n');
  });

  it('splits a text into header and remainder if header is really header', () => {
    const result = Renderer.titleAndRenderedTail('Hallo\n----\nDresden');
    expect(result).to.have.property('title', 'Hallo');
    expect(result).to.have.property('body', '<p>Dresden</p>\n');
  });

  it('splits a text into header and remainder if header has nested markdown', () => {
    const result = Renderer.titleAndRenderedTail('## Hallo *kursiv* jj\n\nDresden');
    expect(result).to.have.property('title', 'Hallo *kursiv* jj');
    expect(result).to.have.property('body', '<p>Dresden</p>\n');
  });

  it('should get along with "null" or "undefined" input when rendering', () => {
    expect(Renderer.render(undefined, '')).to.be('');
    expect(Renderer.render(null, '')).to.be('');
  });

});
