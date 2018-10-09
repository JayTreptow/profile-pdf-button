
(function() {
  var PDFDocument, PDFObject, PDFPage, PDFReference, fs, stream,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  stream = require('stream');

  fs = require('fs');

  PDFObject = require('./object');

  PDFReference = require('./reference');

  PDFPage = require('./page');

  PDFDocument = (function(superClass) {
    var mixin;

    extend(PDFDocument, superClass);

    function PDFDocument(options1) {
      var key, ref1, ref2, val;
      this.options = options1 != null ? options1 : {};
      PDFDocument.__super__.constructor.apply(this, arguments);
      this.version = 1.3;
      this.compress = (ref1 = this.options.compress) != null ? ref1 : true;
      this._pageBuffer = [];
      this._pageBufferStart = 0;
      this._offsets = [];
      this._waiting = 0;
      this._ended = false;
      this._offset = 0;
      this._root = this.ref({
        Type: 'Catalog',
        Pages: this.ref({
          Type: 'Pages',
          Count: 0,
          Kids: []
        })
      });
      this.page = null;
      this.initColor();
      this.initVector();
      this.initFonts();
      this.initText();
      this.initImages();
      this.info = {
        Producer: 'PDFKit',
        Creator: 'PDFKit',
        CreationDate: new Date()
      };
      if (this.options.info) {
        ref2 = this.options.info;
        for (key in ref2) {
          val = ref2[key];
          this.info[key] = val;
        }
      }
      this._write("%PDF-" + this.version);
      this._write("%\xFF\xFF\xFF\xFF");
      if (this.options.autoFirstPage !== false) {
        this.addPage();
      }
    }

    mixin = function(methods) {
      var method, name, results;
      results = [];
      for (name in methods) {
        method = methods[name];
        results.push(PDFDocument.prototype[name] = method);
      }
      return results;
    };

    mixin(require('./mixins/color'));

    mixin(require('./mixins/vector'));

    mixin(require('./mixins/fonts'));

    mixin(require('./mixins/text'));

    mixin(require('./mixins/images'));

    mixin(require('./mixins/annotations'));

    PDFDocument.prototype.addPage = function(options) {
      var pages;
      if (options == null) {
        options = this.options;
      }
      if (!this.options.bufferPages) {
        this.flushPages();
      }
      this.page = new PDFPage(this, options);
      this._pageBuffer.push(this.page);
      pages = this._root.data.Pages.data;
      pages.Kids.push(this.page.dictionary);
      pages.Count++;
      this.x = this.page.margins.left;
      this.y = this.page.margins.top;
      this._ctm = [1, 0, 0, 1, 0, 0];
      this.transform(1, 0, 0, -1, 0, this.page.height);
      this.emit('pageAdded');
      return this;
    };

    PDFDocument.prototype.bufferedPageRange = function() {
      return {
        start: this._pageBufferStart,
        count: this._pageBuffer.length
      };
    };

    PDFDocument.prototype.switchToPage = function(n) {
      var page;
      if (!(page = this._pageBuffer[n - this._pageBufferStart])) {
        throw new Error("switchToPage(" + n + ") out of bounds, current buffer covers pages " + this._pageBufferStart + " to " + (this._pageBufferStart + this._pageBuffer.length - 1));
      }
      return this.page = page;
    };

    PDFDocument.prototype.flushPages = function() {
      var i, len, page, pages;
      pages = this._pageBuffer;
      this._pageBuffer = [];
      this._pageBufferStart += pages.length;
      for (i = 0, len = pages.length; i < len; i++) {
        page = pages[i];
        page.end();
      }
    };

    PDFDocument.prototype.ref = function(data) {
      var ref;
      ref = new PDFReference(this, this._offsets.length + 1, data);
      this._offsets.push(null);
      this._waiting++;
      return ref;
    };

    PDFDocument.prototype._read = function() {};

    PDFDocument.prototype._write = function(data) {
      if (!Buffer.isBuffer(data)) {
        data = new Buffer(data + '\n', 'binary');
      }
      this.push(data);
      return this._offset += data.length;
    };

    PDFDocument.prototype.addContent = function(data) {
      this.page.write(data);
      return this;
    };

    PDFDocument.prototype._refEnd = function(ref) {
      this._offsets[ref.id - 1] = ref.offset;
      if (--this._waiting === 0 && this._ended) {
        this._finalize();
        return this._ended = false;
      }
    };

    PDFDocument.prototype.write = function(filename, fn) {
      var err;
      err = new Error('PDFDocument#write is deprecated, and will be removed in a future version of PDFKit. Please pipe the document into a Node stream.');
      console.warn(err.stack);
      this.pipe(fs.createWriteStream(filename));
      this.end();
      return this.once('end', fn);
    };

    PDFDocument.prototype.output = function(fn) {
      throw new Error('PDFDocument#output is deprecated, and has been removed from PDFKit. Please pipe the document into a Node stream.');
    };

    PDFDocument.prototype.end = function() {
      var font, key, name, ref1, ref2, val;
      this.flushPages();
      this._info = this.ref();
      ref1 = this.info;
      for (key in ref1) {
        val = ref1[key];
        if (typeof val === 'string') {
          val = new String(val);
        }
        this._info.data[key] = val;
      }
      this._info.end();
      ref2 = this._fontFamilies;
      for (name in ref2) {
        font = ref2[name];
        font.finalize();
      }
      this._root.end();
      this._root.data.Pages.end();
      if (this._waiting === 0) {
        return this._finalize();
      } else {
        return this._ended = true;
      }
    };

    PDFDocument.prototype._finalize = function(fn) {
      var i, len, offset, ref1, xRefOffset;
      xRefOffset = this._offset;
      this._write("xref");
      this._write("0 " + (this._offsets.length + 1));
      this._write("0000000000 65535 f ");
      ref1 = this._offsets;
      for (i = 0, len = ref1.length; i < len; i++) {
        offset = ref1[i];
        offset = ('0000000000' + offset).slice(-10);
        this._write(offset + ' 00000 n ');
      }
      this._write('trailer');
      this._write(PDFObject.convert({
        Size: this._offsets.length + 1,
        Root: this._root,
        Info: this._info
      }));
      this._write('startxref');
      this._write("" + xRefOffset);
      this._write('%%EOF');
      return this.push(null);
    };

    PDFDocument.prototype.toString = function() {
      return "[object PDFDocument]";
    };

    return PDFDocument;

  })(stream.Readable);

  module.exports = PDFDocument;

}).call(this);
