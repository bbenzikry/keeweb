'use strict';

const Backbone = require('backbone');
const FieldView = require('./field-view');
const GeneratorView = require('../generator-view');
const KeyHandler = require('../../comp/key-handler');
const Keys = require('../../const/keys');
const PasswordGenerator = require('../../util/password-generator');
const kdbxweb = require('kdbxweb');

const FieldViewText = FieldView.extend({
    renderValue: function(value) {
        return value && value.isProtected ? PasswordGenerator.present(value.textLength)
            : _.escape(value || '').replace(/\n/g, '<br/>');
    },

    getEditValue: function(value) {
        return value && value.isProtected ? value.getText() : value || '';
    },

    startEdit: function() {
        const text = this.getEditValue(this.value);
        const isProtected = !!(this.value && this.value.isProtected);
        this.$el.toggleClass('details__field--protected', isProtected);
        this.input = $(document.createElement(this.model.multiline ? 'textarea' : 'input'));
        this.valueEl.html('').append(this.input);
        this.input.attr({ autocomplete: 'off', spellcheck: 'false' })
            .val(text).focus()[0].setSelectionRange(text.length, text.length);
        this.input.bind({
            input: this.fieldValueInput.bind(this),
            keydown: this.fieldValueKeydown.bind(this),
            keypress: this.fieldValueInput.bind(this),
            click: this.fieldValueInputClick.bind(this),
            mousedown: this.fieldValueInputMouseDown.bind(this)
        });
        this.listenTo(Backbone, 'click', this.fieldValueBlur);
        this.listenTo(Backbone, 'main-window-will-close user-idle', this.externalEndEdit);
        if (this.model.multiline) {
            this.setInputHeight();
        }
        if (this.model.canGen) {
            $('<div/>').addClass('details__field-value-btn details__field-value-btn-gen').appendTo(this.valueEl)
                .click(this.showGeneratorClick.bind(this))
                .mousedown(this.showGenerator.bind(this));
        }
    },

    showGeneratorClick: function(e) {
        e.stopPropagation();
        if (!this.gen) {
            this.input.focus();
        }
    },

    showGenerator: function() {
        if (this.gen) {
            this.hideGenerator();
        } else {
            const fieldRect = this.input[0].getBoundingClientRect();
            this.gen = new GeneratorView({model: {pos: {left: fieldRect.left, top: fieldRect.bottom}, password: this.value}}).render();
            this.gen.once('remove', this.generatorClosed.bind(this));
            this.gen.once('result', this.generatorResult.bind(this));
        }
    },

    hideGenerator: function() {
        if (this.gen) {
            const gen = this.gen;
            delete this.gen;
            gen.remove();
        }
    },

    generatorClosed: function() {
        if (this.gen) {
            delete this.gen;
            this.endEdit();
        }
    },

    generatorResult: function(password) {
        if (this.gen) {
            delete this.gen;
            this.endEdit(password);
        }
    },

    setInputHeight: function() {
        const MinHeight = 18;
        this.input.height(MinHeight);
        let newHeight = this.input[0].scrollHeight;
        if (newHeight <= MinHeight) {
            newHeight = MinHeight;
        } else {
            newHeight += 2;
        }
        this.input.height(newHeight);
    },

    fieldValueBlur: function() {
        if (!this.gen && this.input) {
            this.endEdit(this.input.val());
        }
    },

    fieldValueInput: function(e) {
        e.stopPropagation();
        if (this.model.multiline) {
            this.setInputHeight();
        }
    },

    fieldValueInputClick: function() {
        if (this.gen) {
            this.hideGenerator();
        }
    },

    fieldValueInputMouseDown: function(e) {
        e.stopPropagation();
    },

    fieldValueKeydown: function(e) {
        KeyHandler.reg();
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_RETURN) {
            if (!this.model.multiline || (!e.altKey && !e.shiftKey && !e.ctrlKey)) {
                if (this.gen) {
                    e.target.value = this.gen.password;
                    this.hideGenerator();
                    return;
                }
                this.stopBlurListener();
                this.endEdit(e.target.value);
            }
        } else if (code === Keys.DOM_VK_ESCAPE) {
            this.stopBlurListener();
            this.endEdit();
        } else if (code === Keys.DOM_VK_TAB) {
            e.preventDefault();
            this.stopBlurListener();
            this.endEdit(e.target.value, { tab: { field: this.model.name, prev: e.shiftKey } });
        } else if (code === Keys.DOM_VK_G && e.metaKey) {
            e.preventDefault();
            this.showGenerator();
        } else if (code === Keys.DOM_VK_S && (e.metaKey || e.ctrlKey)) {
            this.stopBlurListener();
            this.endEdit(e.target.value);
            return;
        }
        e.stopPropagation();
    },

    externalEndEdit: function() {
        if (this.input) {
            this.endEdit(this.input.val());
        }
    },

    endEdit: function(newVal, extra) {
        if (this.gen) {
            this.hideGenerator();
        }
        if (!this.editing) {
            return;
        }
        delete this.input;
        this.stopBlurListener();
        if (typeof newVal === 'string' && this.value instanceof kdbxweb.ProtectedValue) {
            newVal = kdbxweb.ProtectedValue.fromString(newVal);
        }
        if (typeof newVal === 'string') {
            newVal = $.trim(newVal);
        }
        FieldView.prototype.endEdit.call(this, newVal, extra);
    },

    stopBlurListener: function() {
        this.stopListening(Backbone, 'click main-window-will-close', this.fieldValueBlur);
    },

    render: function() {
        FieldView.prototype.render.call(this);
    }
});

module.exports = FieldViewText;
