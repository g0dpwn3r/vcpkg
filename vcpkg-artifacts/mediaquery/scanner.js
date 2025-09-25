"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaQueryError = exports.Scanner = exports.Kind = exports.format = exports.messages = exports.MessageCategory = void 0;
const i18n_1 = require("../i18n");
const character_codes_1 = require("./character-codes");
var MessageCategory;
(function (MessageCategory) {
    MessageCategory[MessageCategory["Warning"] = 0] = "Warning";
    MessageCategory[MessageCategory["Error"] = 1] = "Error";
    MessageCategory[MessageCategory["Suggestion"] = 2] = "Suggestion";
    MessageCategory[MessageCategory["Message"] = 3] = "Message";
})(MessageCategory = exports.MessageCategory || (exports.MessageCategory = {}));
exports.messages = {
    DigitExpected: { code: 1100, category: MessageCategory.Error, text: 'Digit expected (0-9)' },
    HexDigitExpected: { code: 1101, category: MessageCategory.Error, text: 'Hex Digit expected (0-F,0-f)' },
    BinaryDigitExpected: { code: 1102, category: MessageCategory.Error, text: 'Binary Digit expected (0,1)' },
    UnexpectedEndOfFile: { code: 1103, category: MessageCategory.Error, text: 'Unexpected end of file while searching for \'{0}\'' },
    InvalidEscapeSequence: { code: 1104, category: MessageCategory.Error, text: 'Invalid escape sequence' },
};
function format(text, ...args) {
    return text.replace(/{(\d+)}/g, (_match, index) => '' + args[+index] || '<ARGMISSING>');
}
exports.format = format;
// All conflict markers consist of the same character repeated seven times.  If it is
// a <<<<<<< or >>>>>>> marker then it is also followed by a space.
const mergeConflictMarkerLength = 7;
var Kind;
(function (Kind) {
    Kind[Kind["Unknown"] = 0] = "Unknown";
    Kind[Kind["EndOfFile"] = 1] = "EndOfFile";
    Kind[Kind["SingleLineComment"] = 2] = "SingleLineComment";
    Kind[Kind["MultiLineComment"] = 3] = "MultiLineComment";
    Kind[Kind["NewLine"] = 4] = "NewLine";
    Kind[Kind["Whitespace"] = 5] = "Whitespace";
    // We detect and provide better error recovery when we encounter a git merge marker.  This
    // allows us to edit files with git-conflict markers in them in a much more pleasant manner.
    Kind[Kind["ConflictMarker"] = 6] = "ConflictMarker";
    // Literals
    Kind[Kind["NumericLiteral"] = 7] = "NumericLiteral";
    Kind[Kind["StringLiteral"] = 8] = "StringLiteral";
    // Boolean Literals
    Kind[Kind["BooleanLiteral"] = 9] = "BooleanLiteral";
    Kind[Kind["TrueKeyword"] = 10] = "TrueKeyword";
    Kind[Kind["FalseKeyword"] = 11] = "FalseKeyword";
    // Punctuation
    Kind[Kind["OpenBrace"] = 12] = "OpenBrace";
    Kind[Kind["CloseBrace"] = 13] = "CloseBrace";
    Kind[Kind["OpenParen"] = 14] = "OpenParen";
    Kind[Kind["CloseParen"] = 15] = "CloseParen";
    Kind[Kind["OpenBracket"] = 16] = "OpenBracket";
    Kind[Kind["CloseBracket"] = 17] = "CloseBracket";
    Kind[Kind["Dot"] = 18] = "Dot";
    Kind[Kind["Elipsis"] = 19] = "Elipsis";
    Kind[Kind["Semicolon"] = 20] = "Semicolon";
    Kind[Kind["Comma"] = 21] = "Comma";
    Kind[Kind["QuestionDot"] = 22] = "QuestionDot";
    Kind[Kind["LessThan"] = 23] = "LessThan";
    Kind[Kind["OpenAngle"] = 23] = "OpenAngle";
    Kind[Kind["LessThanSlash"] = 24] = "LessThanSlash";
    Kind[Kind["GreaterThan"] = 25] = "GreaterThan";
    Kind[Kind["CloseAngle"] = 25] = "CloseAngle";
    Kind[Kind["LessThanEquals"] = 26] = "LessThanEquals";
    Kind[Kind["GreaterThanEquals"] = 27] = "GreaterThanEquals";
    Kind[Kind["EqualsEquals"] = 28] = "EqualsEquals";
    Kind[Kind["ExclamationEquals"] = 29] = "ExclamationEquals";
    Kind[Kind["EqualsEqualsEquals"] = 30] = "EqualsEqualsEquals";
    Kind[Kind["ExclamationEqualsEquals"] = 31] = "ExclamationEqualsEquals";
    Kind[Kind["EqualsArrow"] = 32] = "EqualsArrow";
    Kind[Kind["Plus"] = 33] = "Plus";
    Kind[Kind["Minus"] = 34] = "Minus";
    Kind[Kind["Asterisk"] = 35] = "Asterisk";
    Kind[Kind["AsteriskAsterisk"] = 36] = "AsteriskAsterisk";
    Kind[Kind["Slash"] = 37] = "Slash";
    Kind[Kind["Percent"] = 38] = "Percent";
    Kind[Kind["PlusPlus"] = 39] = "PlusPlus";
    Kind[Kind["MinusMinus"] = 40] = "MinusMinus";
    Kind[Kind["LessThanLessThan"] = 41] = "LessThanLessThan";
    Kind[Kind["GreaterThanGreaterThan"] = 42] = "GreaterThanGreaterThan";
    Kind[Kind["GreaterThanGreaterThanGreaterThan"] = 43] = "GreaterThanGreaterThanGreaterThan";
    Kind[Kind["Ampersand"] = 44] = "Ampersand";
    Kind[Kind["Bar"] = 45] = "Bar";
    Kind[Kind["Caret"] = 46] = "Caret";
    Kind[Kind["Exclamation"] = 47] = "Exclamation";
    Kind[Kind["Tilde"] = 48] = "Tilde";
    Kind[Kind["AmpersandAmpersand"] = 49] = "AmpersandAmpersand";
    Kind[Kind["BarBar"] = 50] = "BarBar";
    Kind[Kind["Question"] = 51] = "Question";
    Kind[Kind["Colon"] = 52] = "Colon";
    Kind[Kind["At"] = 53] = "At";
    Kind[Kind["QuestionQuestion"] = 54] = "QuestionQuestion";
    // Assignments
    Kind[Kind["Equals"] = 55] = "Equals";
    Kind[Kind["PlusEquals"] = 56] = "PlusEquals";
    Kind[Kind["MinusEquals"] = 57] = "MinusEquals";
    Kind[Kind["AsteriskEquals"] = 58] = "AsteriskEquals";
    Kind[Kind["AsteriskAsteriskEquals"] = 59] = "AsteriskAsteriskEquals";
    Kind[Kind["SlashEquals"] = 60] = "SlashEquals";
    Kind[Kind["PercentEquals"] = 61] = "PercentEquals";
    Kind[Kind["LessThanLessThanEquals"] = 62] = "LessThanLessThanEquals";
    Kind[Kind["GreaterThanGreaterThanEquals"] = 63] = "GreaterThanGreaterThanEquals";
    Kind[Kind["GreaterThanGreaterThanGreaterThanEquals"] = 64] = "GreaterThanGreaterThanGreaterThanEquals";
    Kind[Kind["AmpersandEquals"] = 65] = "AmpersandEquals";
    Kind[Kind["BarEquals"] = 66] = "BarEquals";
    Kind[Kind["BarBarEquals"] = 67] = "BarBarEquals";
    Kind[Kind["AmpersandAmpersandEquals"] = 68] = "AmpersandAmpersandEquals";
    Kind[Kind["QuestionQuestionEquals"] = 69] = "QuestionQuestionEquals";
    Kind[Kind["CaretEquals"] = 70] = "CaretEquals";
    // Identifiers
    Kind[Kind["Identifier"] = 71] = "Identifier";
    // Keywords
    Kind[Kind["KeywordsStart"] = 1000] = "KeywordsStart";
    Kind[Kind["AndKeyword"] = 1001] = "AndKeyword";
    Kind[Kind["NotKeyword"] = 1002] = "NotKeyword";
    Kind[Kind["KeywordsEnd"] = 1003] = "KeywordsEnd";
    // Tokens that can represent elements
    Kind[Kind["Elements"] = 2000] = "Elements";
    Kind[Kind["Model"] = 2001] = "Model";
    Kind[Kind["Enum"] = 2002] = "Enum";
    Kind[Kind["EnumValue"] = 2003] = "EnumValue";
    Kind[Kind["Import"] = 2004] = "Import";
    Kind[Kind["TypeAlias"] = 2005] = "TypeAlias";
    Kind[Kind["ParameterAlias"] = 2006] = "ParameterAlias";
    Kind[Kind["ResponseAlias"] = 2007] = "ResponseAlias";
    Kind[Kind["Interface"] = 2008] = "Interface";
    Kind[Kind["Operation"] = 2009] = "Operation";
    Kind[Kind["Annotation"] = 2010] = "Annotation";
    Kind[Kind["Documentation"] = 2011] = "Documentation";
    Kind[Kind["Label"] = 2012] = "Label";
    Kind[Kind["Preamble"] = 2013] = "Preamble";
    Kind[Kind["Property"] = 2014] = "Property";
    Kind[Kind["Parameter"] = 2015] = "Parameter";
    Kind[Kind["TemplateDeclaration"] = 2016] = "TemplateDeclaration";
    Kind[Kind["TemplateParameters"] = 2017] = "TemplateParameters";
    Kind[Kind["Parent"] = 2018] = "Parent";
    Kind[Kind["Response"] = 2019] = "Response";
    Kind[Kind["ResponseExpression"] = 2020] = "ResponseExpression";
    Kind[Kind["Result"] = 2021] = "Result";
    Kind[Kind["TypeExpression"] = 2022] = "TypeExpression";
    Kind[Kind["Union"] = 2023] = "Union";
})(Kind = exports.Kind || (exports.Kind = {}));
const keywords = new Map([
    ['NOT', Kind.NotKeyword],
    ['not', Kind.NotKeyword],
    ['AND', Kind.AndKeyword],
    ['and', Kind.AndKeyword],
    ['true', Kind.BooleanLiteral],
    ['false', Kind.BooleanLiteral] // FalseKeyword
]);
class Scanner {
    #offset = 0;
    #line = 0;
    #column = 0;
    #map = new Array();
    #length;
    #text;
    #ch;
    #chNext;
    #chNextNext;
    #chSz;
    #chNextSz;
    #chNextNextSz;
    /** The assumed tab width. If this is set before scanning, it enables accurate Position tracking. */
    tabWidth = 2;
    // current token information
    /** the character offset within the document */
    offset;
    /** the token kind */
    kind;
    /** the text of the current token (when appropriate) */
    text;
    /** the string value of current string literal token (unquoted, unescaped) */
    stringValue;
    /** returns the Position (line/column) of the current token */
    get position() {
        return this.positionFromOffset(this.offset);
    }
    constructor(text) {
        this.#text = text;
        this.#length = text.length;
        this.advance(0);
        this.markPosition();
        // let's hide these, then we can clone this nicely.
        Object.defineProperty(this, 'tabWidth', { enumerable: false });
    }
    get eof() {
        return this.#offset > (this.#length);
    }
    advance(count) {
        let codeOrChar;
        let newOffset;
        let offsetAdvancedBy = 0;
        switch (count) {
            case undefined:
            case 1:
                offsetAdvancedBy = this.#chSz;
                this.#offset += this.#chSz;
                this.#ch = this.#chNext;
                this.#chSz = this.#chNextSz;
                this.#chNext = this.#chNextNext;
                this.#chNextSz = this.#chNextNextSz;
                newOffset = this.#offset + this.#chSz + this.#chNextSz;
                codeOrChar = this.#text.charCodeAt(newOffset);
                this.#chNextNext = (this.#chNextNextSz = (0, character_codes_1.sizeOf)(codeOrChar)) === 1 ? codeOrChar : this.#text.codePointAt(newOffset);
                return offsetAdvancedBy;
            case 2:
                offsetAdvancedBy = this.#chSz + this.#chNextSz;
                this.#offset += this.#chSz + this.#chNextSz;
                this.#ch = this.#chNextNext;
                this.#chSz = this.#chNextNextSz;
                newOffset = this.#offset + this.#chSz;
                codeOrChar = this.#text.charCodeAt(newOffset);
                this.#chNext = (this.#chNextSz = (0, character_codes_1.sizeOf)(codeOrChar)) === 1 ? codeOrChar : this.#text.codePointAt(newOffset);
                newOffset += this.#chNextSz;
                codeOrChar = this.#text.charCodeAt(newOffset);
                this.#chNextNext = (this.#chNextNextSz = (0, character_codes_1.sizeOf)(codeOrChar)) === 1 ? codeOrChar : this.#text.codePointAt(newOffset);
                return offsetAdvancedBy;
            default:
            case 3:
                offsetAdvancedBy = this.#chSz + this.#chNextSz + this.#chNextNextSz;
                count -= 3;
                while (count) {
                    // skip over characters while we work.
                    offsetAdvancedBy += (0, character_codes_1.sizeOf)(this.#text.charCodeAt(this.#offset + offsetAdvancedBy));
                }
                this.#offset += offsetAdvancedBy;
            // eslint-disable-next-line no-fallthrough
            case 0:
                newOffset = this.#offset;
                codeOrChar = this.#text.charCodeAt(newOffset);
                this.#ch = (this.#chSz = (0, character_codes_1.sizeOf)(codeOrChar)) === 1 ? codeOrChar : this.#text.codePointAt(newOffset);
                newOffset += this.#chSz;
                codeOrChar = this.#text.charCodeAt(newOffset);
                this.#chNext = (this.#chNextSz = (0, character_codes_1.sizeOf)(codeOrChar)) === 1 ? codeOrChar : this.#text.codePointAt(newOffset);
                newOffset += this.#chNextSz;
                codeOrChar = this.#text.charCodeAt(newOffset);
                this.#chNextNext = (this.#chNextNextSz = (0, character_codes_1.sizeOf)(codeOrChar)) === 1 ? codeOrChar : this.#text.codePointAt(newOffset);
                return offsetAdvancedBy;
        }
    }
    next(token, count = 1, value) {
        const originalOffset = this.#offset;
        const offsetAdvancedBy = this.advance(count);
        this.text = value || this.#text.substr(originalOffset, offsetAdvancedBy);
        this.#column += count;
        return this.kind = token;
    }
    /** adds the current position to the token to the offset:position map */
    markPosition() {
        this.#map.push({ offset: this.#offset, column: this.#column, line: this.#line });
    }
    /** updates the position and marks the location  */
    newLine(count = 1) {
        this.text = this.#text.substr(this.#offset, count);
        this.advance(count);
        this.#line++;
        this.#column = 0;
        this.markPosition(); // make sure the map has the new location
        return this.kind = Kind.NewLine;
    }
    start() {
        if (this.offset === undefined) {
            this.scan();
        }
        return this;
    }
    /**
     * Identifies and returns the next token type in the document
     *
     * @returns the state of the scanner will have the properties `token`, `value`, `offset` pointing to the current token at the end of this call.
     *
     * @notes before this call, `#offset` is pointing to the next character to be evaluated.
     *
     */
    scan() {
        // this token starts at
        this.offset = this.#offset;
        this.stringValue = undefined;
        if (!this.eof) {
            switch (this.#ch) {
                case 13 /* CharacterCodes.carriageReturn */:
                    return this.newLine(this.#chNext === 10 /* CharacterCodes.lineFeed */ ? 2 : 1);
                case 10 /* CharacterCodes.lineFeed */:
                    return this.newLine();
                case 9 /* CharacterCodes.tab */:
                case 11 /* CharacterCodes.verticalTab */:
                case 12 /* CharacterCodes.formFeed */:
                case 32 /* CharacterCodes.space */:
                case 160 /* CharacterCodes.nonBreakingSpace */:
                case 5760 /* CharacterCodes.ogham */:
                case 8192 /* CharacterCodes.enQuad */:
                case 8193 /* CharacterCodes.emQuad */:
                case 8194 /* CharacterCodes.enSpace */:
                case 8195 /* CharacterCodes.emSpace */:
                case 8196 /* CharacterCodes.threePerEmSpace */:
                case 8197 /* CharacterCodes.fourPerEmSpace */:
                case 8198 /* CharacterCodes.sixPerEmSpace */:
                case 8199 /* CharacterCodes.figureSpace */:
                case 8200 /* CharacterCodes.punctuationSpace */:
                case 8201 /* CharacterCodes.thinSpace */:
                case 8202 /* CharacterCodes.hairSpace */:
                case 8203 /* CharacterCodes.zeroWidthSpace */:
                case 8239 /* CharacterCodes.narrowNoBreakSpace */:
                case 8287 /* CharacterCodes.mathematicalSpace */:
                case 12288 /* CharacterCodes.ideographicSpace */:
                case 65279 /* CharacterCodes.byteOrderMark */:
                    return this.scanWhitespace();
                case 40 /* CharacterCodes.openParen */:
                    return this.next(Kind.OpenParen);
                case 41 /* CharacterCodes.closeParen */:
                    return this.next(Kind.CloseParen);
                case 44 /* CharacterCodes.comma */:
                    return this.next(Kind.Comma);
                case 58 /* CharacterCodes.colon */:
                    return this.next(Kind.Colon);
                case 59 /* CharacterCodes.semicolon */:
                    return this.next(Kind.Semicolon);
                case 91 /* CharacterCodes.openBracket */:
                    return this.next(Kind.OpenBracket);
                case 93 /* CharacterCodes.closeBracket */:
                    return this.next(Kind.CloseBracket);
                case 123 /* CharacterCodes.openBrace */:
                    return this.next(Kind.OpenBrace);
                case 125 /* CharacterCodes.closeBrace */:
                    return this.next(Kind.CloseBrace);
                case 126 /* CharacterCodes.tilde */:
                    return this.next(Kind.Tilde);
                case 64 /* CharacterCodes.at */:
                    return this.next(Kind.At);
                case 94 /* CharacterCodes.caret */:
                    return this.#chNext === 61 /* CharacterCodes.equals */ ? this.next(Kind.CaretEquals, 2) : this.next(Kind.Caret);
                case 37 /* CharacterCodes.percent */:
                    return this.#chNext === 61 /* CharacterCodes.equals */ ? this.next(Kind.PercentEquals, 2) : this.next(Kind.Percent);
                case 63 /* CharacterCodes.question */:
                    return this.#chNext === 46 /* CharacterCodes.dot */ && !(0, character_codes_1.isDigit)(this.#chNextNext) ?
                        this.next(Kind.QuestionDot, 2) :
                        this.#chNext === 63 /* CharacterCodes.question */ ?
                            this.#chNextNext === 61 /* CharacterCodes.equals */ ?
                                this.next(Kind.QuestionQuestionEquals, 3) :
                                this.next(Kind.QuestionQuestion, 2) :
                            this.next(Kind.Question);
                case 33 /* CharacterCodes.exclamation */:
                    return this.#chNext === 61 /* CharacterCodes.equals */ ?
                        this.#chNextNext === 61 /* CharacterCodes.equals */ ?
                            this.next(Kind.ExclamationEqualsEquals, 3) :
                            this.next(Kind.ExclamationEquals, 2) :
                        this.next(Kind.Exclamation);
                case 38 /* CharacterCodes.ampersand */:
                    return this.#chNext === 38 /* CharacterCodes.ampersand */ ?
                        this.#chNextNext === 61 /* CharacterCodes.equals */ ?
                            this.next(Kind.AmpersandAmpersandEquals, 3) :
                            this.next(Kind.AmpersandAmpersand, 2) :
                        this.#chNext === 61 /* CharacterCodes.equals */ ?
                            this.next(Kind.AmpersandEquals, 2) :
                            this.next(Kind.Ampersand);
                case 42 /* CharacterCodes.asterisk */:
                    return this.#chNext === 42 /* CharacterCodes.asterisk */ ?
                        this.#chNextNext === 61 /* CharacterCodes.equals */ ?
                            this.next(Kind.AsteriskAsteriskEquals, 3) :
                            this.next(Kind.AsteriskAsterisk, 2) :
                        this.#chNext === 61 /* CharacterCodes.equals */ ?
                            this.next(Kind.AsteriskEquals, 2) :
                            this.next(Kind.Asterisk);
                case 43 /* CharacterCodes.plus */:
                    return this.#chNext === 43 /* CharacterCodes.plus */ ?
                        this.next(Kind.PlusPlus, 2) :
                        this.#chNext === 61 /* CharacterCodes.equals */ ?
                            this.next(Kind.PlusEquals, 2) :
                            this.next(Kind.Plus);
                case 45 /* CharacterCodes.minus */:
                    return this.#chNext === 45 /* CharacterCodes.minus */ ?
                        this.next(Kind.MinusMinus, 2) :
                        this.#chNext === 61 /* CharacterCodes.equals */ ?
                            this.next(Kind.MinusEquals, 2) :
                            this.next(Kind.Minus);
                case 46 /* CharacterCodes.dot */:
                    return (0, character_codes_1.isDigit)(this.#chNext) ?
                        this.scanNumber() :
                        this.#chNext === 46 /* CharacterCodes.dot */ && this.#chNextNext === 46 /* CharacterCodes.dot */ ?
                            this.next(Kind.Elipsis, 3) :
                            this.next(Kind.Dot);
                case 47 /* CharacterCodes.slash */:
                    return this.#chNext === 47 /* CharacterCodes.slash */ ?
                        this.scanSingleLineComment() :
                        this.#chNext === 42 /* CharacterCodes.asterisk */ ?
                            this.scanMultiLineComment() :
                            this.#chNext === 61 /* CharacterCodes.equals */ ?
                                this.next(Kind.SlashEquals) :
                                this.next(Kind.Slash);
                case 48 /* CharacterCodes._0 */:
                    return this.#chNext === 120 /* CharacterCodes.x */ || this.#chNext === 88 /* CharacterCodes.X */ ?
                        this.scanHexNumber() :
                        this.#chNext === 66 /* CharacterCodes.B */ || this.#chNext === 66 /* CharacterCodes.B */ ?
                            this.scanBinaryNumber() :
                            this.scanNumber();
                case 49 /* CharacterCodes._1 */:
                case 50 /* CharacterCodes._2 */:
                case 51 /* CharacterCodes._3 */:
                case 52 /* CharacterCodes._4 */:
                case 53 /* CharacterCodes._5 */:
                case 54 /* CharacterCodes._6 */:
                case 55 /* CharacterCodes._7 */:
                case 56 /* CharacterCodes._8 */:
                case 57 /* CharacterCodes._9 */:
                    return this.scanNumber();
                case 60 /* CharacterCodes.lessThan */:
                    return this.isConflictMarker() ?
                        this.next(Kind.ConflictMarker, mergeConflictMarkerLength) :
                        this.#chNext === 60 /* CharacterCodes.lessThan */ ?
                            this.#chNextNext === 61 /* CharacterCodes.equals */ ?
                                this.next(Kind.LessThanLessThanEquals, 3) :
                                this.next(Kind.LessThanLessThan, 2) :
                            this.#chNext === 61 /* CharacterCodes.equals */ ?
                                this.next(Kind.LessThanEquals, 2) :
                                this.next(Kind.LessThan);
                case 62 /* CharacterCodes.greaterThan */:
                    return this.isConflictMarker() ?
                        this.next(Kind.ConflictMarker, mergeConflictMarkerLength) :
                        this.next(Kind.GreaterThan);
                case 61 /* CharacterCodes.equals */:
                    return this.isConflictMarker() ?
                        this.next(Kind.ConflictMarker, mergeConflictMarkerLength) :
                        this.#chNext === 61 /* CharacterCodes.equals */ ?
                            this.#chNextNext === 61 /* CharacterCodes.equals */ ?
                                this.next(Kind.EqualsEqualsEquals, 3) :
                                this.next(Kind.EqualsEquals, 2) :
                            this.#chNext === 62 /* CharacterCodes.greaterThan */ ?
                                this.next(Kind.EqualsArrow, 2) :
                                this.next(Kind.Equals);
                case 124 /* CharacterCodes.bar */:
                    return this.isConflictMarker() ?
                        this.next(Kind.ConflictMarker, mergeConflictMarkerLength) :
                        this.#chNext === 124 /* CharacterCodes.bar */ ?
                            this.#chNextNext === 61 /* CharacterCodes.equals */ ?
                                this.next(Kind.BarBarEquals, 3) :
                                this.next(Kind.BarBar, 2) :
                            this.#chNext === 61 /* CharacterCodes.equals */ ?
                                this.next(Kind.BarEquals, 2) :
                                this.next(Kind.Bar);
                case 39 /* CharacterCodes.singleQuote */:
                case 34 /* CharacterCodes.doubleQuote */:
                case 96 /* CharacterCodes.backtick */:
                    return this.scanString();
                default:
                    // FYI:
                    // Well-known characters that are currently not processed
                    //   # \
                    // will need to update the scanner if there is a need to recognize them
                    return (0, character_codes_1.isIdentifierStart)(this.#ch) ? this.scanIdentifier() : this.next(Kind.Unknown);
            }
        }
        this.text = '';
        return this.kind = Kind.EndOfFile;
    }
    take() {
        const result = { ...this };
        this.scan();
        return result;
    }
    takeWhitespace() {
        while (!this.eof && this.kind === Kind.Whitespace) {
            this.take();
        }
    }
    /**
   * When the current token is greaterThan, this will return any tokens with characters
   * after the greater than character. This has to be scanned separately because greater
   * thans appear in positions where longer tokens are incorrect, e.g. `model x<y>=y;`.
   * The solution is to call rescanGreaterThan from the parser in contexts where longer
   * tokens starting with `>` are allowed (i.e. when parsing binary expressions).
   */
    rescanGreaterThan() {
        if (this.kind === Kind.GreaterThan) {
            return this.#ch === 62 /* CharacterCodes.greaterThan */ ?
                this.#chNext === 61 /* CharacterCodes.equals */ ?
                    this.next(Kind.GreaterThanGreaterThanEquals, 3) :
                    this.next(Kind.GreaterThanGreaterThan, 2) :
                this.#ch === 61 /* CharacterCodes.equals */ ?
                    this.next(Kind.GreaterThanEquals, 2) :
                    this.next(Kind.GreaterThan);
        }
        return this.kind;
    }
    isConflictMarker() {
        // Conflict markers must be at the start of a line.
        if (this.#offset === 0 || (0, character_codes_1.isLineBreak)(this.#text.charCodeAt(this.#offset - 1))) {
            if ((this.#offset + mergeConflictMarkerLength) < this.#length) {
                for (let i = 0; i < mergeConflictMarkerLength; i++) {
                    if (this.#text.charCodeAt(this.#offset + i) !== this.#ch) {
                        return false;
                    }
                }
                return this.#ch === 61 /* CharacterCodes.equals */ || this.#text.charCodeAt(this.#offset + mergeConflictMarkerLength) === 32 /* CharacterCodes.space */;
            }
        }
        return false;
    }
    scanWhitespace() {
        // since whitespace are not always 1 character wide, we're going to mark the position before the whitespace.
        this.markPosition();
        do {
            // advance the position
            this.#column += this.widthOfCh;
            this.advance();
        } while ((0, character_codes_1.isWhiteSpaceSingleLine)(this.#ch));
        // and after...
        this.markPosition();
        this.text = this.#text.substring(this.offset, this.#offset);
        return this.kind = Kind.Whitespace;
    }
    scanDigits() {
        const start = this.#offset;
        while ((0, character_codes_1.isDigit)(this.#ch)) {
            this.advance();
        }
        return this.#text.substring(start, this.#offset);
    }
    scanNumber() {
        const start = this.#offset;
        const main = this.scanDigits();
        let decimal;
        let scientific;
        if (this.#ch === 46 /* CharacterCodes.dot */) {
            this.advance();
            decimal = this.scanDigits();
        }
        if (this.#ch === 69 /* CharacterCodes.E */ || this.#ch === 101 /* CharacterCodes.e */) {
            this.assert((0, character_codes_1.isDigit)(this.#chNext), (0, i18n_1.i) `ParseError: Digit expected (0-9)`);
            this.advance();
            scientific = this.scanDigits();
        }
        this.text = scientific ?
            decimal ?
                `${main}.${decimal}e${scientific}` :
                `${main}e${scientific}` :
            decimal ?
                `${main}.${decimal}` :
                main;
        // update the position
        this.#column += (this.#offset - start);
        return this.kind = Kind.NumericLiteral;
    }
    scanHexNumber() {
        this.assert((0, character_codes_1.isHexDigit)(this.#chNextNext), (0, i18n_1.i) `ParseError: Hex Digit expected (0-F,0-f)`);
        this.advance(2);
        this.text = `0x${this.scanUntil((ch) => !(0, character_codes_1.isHexDigit)(ch), 'Hex Digit')}`;
        return this.kind = Kind.NumericLiteral;
    }
    scanBinaryNumber() {
        this.assert((0, character_codes_1.isBinaryDigit)(this.#chNextNext), (0, i18n_1.i) `ParseError: Binary Digit expected (0,1)`);
        this.advance(2);
        this.text = `0b${this.scanUntil((ch) => !(0, character_codes_1.isBinaryDigit)(ch), 'Binary Digit')}`;
        return this.kind = Kind.NumericLiteral;
    }
    get widthOfCh() {
        return this.#ch === 9 /* CharacterCodes.tab */ ? (this.#column % this.tabWidth || this.tabWidth) : 1;
    }
    scanUntil(predicate, expectedClose, consumeClose) {
        const start = this.#offset;
        do {
            // advance the position
            if ((0, character_codes_1.isLineBreak)(this.#ch)) {
                this.advance(this.#ch === 13 /* CharacterCodes.carriageReturn */ && this.#chNext === 10 /* CharacterCodes.lineFeed */ ? 2 : 1);
                this.#line++;
                this.#column = 0;
                this.markPosition(); // make sure the map has the new location
            }
            else {
                this.#column += this.widthOfCh;
                this.advance();
            }
            if (this.eof) {
                this.assert(!expectedClose, (0, i18n_1.i) `Unexpected end of file while searching for '${expectedClose}'`);
                break;
            }
        } while (!predicate(this.#ch, this.#chNext, this.#chNextNext));
        if (consumeClose) {
            this.advance(consumeClose);
        }
        // and after...
        this.markPosition();
        return this.#text.substring(start, this.#offset);
    }
    scanSingleLineComment() {
        this.text = this.scanUntil(character_codes_1.isLineBreak);
        return this.kind = Kind.SingleLineComment;
    }
    scanMultiLineComment() {
        this.text = this.scanUntil((ch, chNext) => ch === 42 /* CharacterCodes.asterisk */ && chNext === 47 /* CharacterCodes.slash */, '*/', 2);
        return this.kind = Kind.MultiLineComment;
    }
    scanString() {
        const quote = this.#ch;
        const quoteLength = 1;
        const closing = String.fromCharCode(this.#ch);
        let escaped = false;
        let crlf = false;
        let isEscaping = false;
        const text = this.scanUntil((ch, chNext, chNextNext) => {
            if (isEscaping) {
                isEscaping = false;
                return false;
            }
            if (ch === 92 /* CharacterCodes.backslash */) {
                isEscaping = escaped = true;
                return false;
            }
            if (ch == 13 /* CharacterCodes.carriageReturn */) {
                if (chNext == 10 /* CharacterCodes.lineFeed */) {
                    crlf = true;
                }
                return false;
            }
            return ch === quote;
        }, closing, quoteLength);
        // TODO: optimize to single pass over string, easier if we refactor some bookkeeping first.
        // strip quotes
        let value = text.substring(quoteLength, text.length - quoteLength);
        // Normalize CRLF to LF when interpreting value of multi-line string
        // literals. Matches JavaScript behavior and ensures program behavior does
        // not change due to line-ending conversion.
        if (crlf) {
            value = value.replace(/\r\n/g, '\n');
        }
        if (escaped) {
            value = this.unescapeString(value);
        }
        this.text = text;
        this.stringValue = value;
        return this.kind = Kind.StringLiteral;
    }
    unescapeString(text) {
        let result = '';
        let start = 0;
        let pos = 0;
        const end = text.length;
        while (pos < end) {
            let ch = text.charCodeAt(pos);
            if (ch != 92 /* CharacterCodes.backslash */) {
                pos++;
                continue;
            }
            result += text.substring(start, pos);
            pos++;
            ch = text.charCodeAt(pos);
            switch (ch) {
                case 114 /* CharacterCodes.r */:
                    result += '\r';
                    break;
                case 110 /* CharacterCodes.n */:
                    result += '\n';
                    break;
                case 116 /* CharacterCodes.t */:
                    result += '\t';
                    break;
                case 39 /* CharacterCodes.singleQuote */:
                    result += '\'';
                    break;
                case 34 /* CharacterCodes.doubleQuote */:
                    result += '"';
                    break;
                case 92 /* CharacterCodes.backslash */:
                    result += '\\';
                    break;
                case 96 /* CharacterCodes.backtick */:
                    result += '`';
                    break;
                default:
                    throw new MediaQueryError((0, i18n_1.i) `Invalid escape sequence`, this.position.line, this.position.column);
            }
            pos++;
            start = pos;
        }
        result += text.substring(start, pos);
        return result;
    }
    scanIdentifier() {
        this.text = this.scanUntil((ch) => !(0, character_codes_1.isIdentifierPart)(ch));
        return this.kind = keywords.get(this.text) ?? Kind.Identifier;
    }
    /**
   * Returns the zero-based line/column from the given offset
   * (binary search thru the token start locations)
   * @param offset the character position in the document
   */
    positionFromOffset(offset) {
        let position = { line: 0, column: 0, offset: 0 };
        // eslint-disable-next-line keyword-spacing
        if (offset < 0 || offset > this.#length) {
            return { line: position.line, column: position.column };
        }
        let first = 0; //left endpoint
        let last = this.#map.length - 1; //right endpoint
        let middle = Math.floor((first + last) / 2);
        while (first <= last) {
            middle = Math.floor((first + last) / 2);
            position = this.#map[middle];
            if (position.offset === offset) {
                return { line: position.line, column: position.column };
            }
            if (position.offset < offset) {
                first = middle + 1;
                continue;
            }
            last = middle - 1;
            position = this.#map[last];
        }
        return { line: position.line, column: position.column + (offset - position.offset) };
    }
    static *TokensFrom(text) {
        const scanner = new Scanner(text).start();
        while (!scanner.eof) {
            yield scanner.take();
        }
    }
    assert(assertion, message) {
        if (!assertion) {
            const p = this.position;
            throw new MediaQueryError(message, p.line, p.column);
        }
    }
}
exports.Scanner = Scanner;
class MediaQueryError extends Error {
    line;
    column;
    constructor(message, line, column) {
        super(message);
        this.line = line;
        this.column = column;
    }
}
exports.MediaQueryError = MediaQueryError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Nhbm5lci5qcyIsInNvdXJjZVJvb3QiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vbWljcm9zb2Z0L3ZjcGtnLXRvb2wvbWFpbi92Y3BrZy1hcnRpZmFjdHMvIiwic291cmNlcyI6WyJtZWRpYXF1ZXJ5L3NjYW5uZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHVDQUF1QztBQUN2QyxrQ0FBa0M7OztBQUVsQyxrQ0FBNEI7QUFDNUIsdURBQXlLO0FBRXpLLElBQVksZUFLWDtBQUxELFdBQVksZUFBZTtJQUN6QiwyREFBTyxDQUFBO0lBQ1AsdURBQUssQ0FBQTtJQUNMLGlFQUFVLENBQUE7SUFDViwyREFBTyxDQUFBO0FBQ1QsQ0FBQyxFQUxXLGVBQWUsR0FBZix1QkFBZSxLQUFmLHVCQUFlLFFBSzFCO0FBUVksUUFBQSxRQUFRLEdBQUc7SUFDdEIsYUFBYSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsZUFBZSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7SUFDNUYsZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxlQUFlLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSw4QkFBOEIsRUFBRTtJQUN2RyxtQkFBbUIsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLGVBQWUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLDZCQUE2QixFQUFFO0lBQ3pHLG1CQUFtQixFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsZUFBZSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsb0RBQW9ELEVBQUU7SUFDaEkscUJBQXFCLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxlQUFlLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSx5QkFBeUIsRUFBRTtDQUN4RyxDQUFDO0FBRUYsU0FBZ0IsTUFB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
// SIG // Begin signature block
// SIG // MIIoQQYJKoZIhvcNAQcCoIIoMjCCKC4CAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // IKb4TL0USl0iSoqPd5038gpBfiyL1dHSELDjcYRFI26g
// SIG // gg12MIIF9DCCA9ygAwIBAgITMwAABARsdAb/VysncgAA
// SIG // AAAEBDANBgkqhkiG9w0BAQsFADB+MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBT
// SIG // aWduaW5nIFBDQSAyMDExMB4XDTI0MDkxMjIwMTExNFoX
// SIG // DTI1MDkxMTIwMTExNFowdDELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjEeMBwGA1UEAxMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
// SIG // tCg32mOdDA6rBBnZSMwxwXegqiDEUFlvQH9Sxww07hY3
// SIG // w7L52tJxLg0mCZjcszQddI6W4NJYb5E9QM319kyyE0l8
// SIG // EvA/pgcxgljDP8E6XIlgVf6W40ms286Cr0azaA1f7vaJ
// SIG // jjNhGsMqOSSSXTZDNnfKs5ENG0bkXeB2q5hrp0qLsm/T
// SIG // WO3oFjeROZVHN2tgETswHR3WKTm6QjnXgGNj+V6rSZJO
// SIG // /WkTqc8NesAo3Up/KjMwgc0e67x9llZLxRyyMWUBE9co
// SIG // T2+pUZqYAUDZ84nR1djnMY3PMDYiA84Gw5JpceeED38O
// SIG // 0cEIvKdX8uG8oQa047+evMfDRr94MG9EWwIDAQABo4IB
// SIG // czCCAW8wHwYDVR0lBBgwFgYKKwYBBAGCN0wIAQYIKwYB
// SIG // BQUHAwMwHQYDVR0OBBYEFPIboTWxEw1PmVpZS+AzTDwo
// SIG // oxFOMEUGA1UdEQQ+MDykOjA4MR4wHAYDVQQLExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24xFjAUBgNVBAUTDTIzMDAx
// SIG // Mis1MDI5MjMwHwYDVR0jBBgwFoAUSG5k5VAF04KqFzc3
// SIG // IrVtqMp1ApUwVAYDVR0fBE0wSzBJoEegRYZDaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jcmwvTWlj
// SIG // Q29kU2lnUENBMjAxMV8yMDExLTA3LTA4LmNybDBhBggr
// SIG // BgEFBQcBAQRVMFMwUQYIKwYBBQUHMAKGRWh0dHA6Ly93
// SIG // d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY2VydHMvTWlj
// SIG // Q29kU2lnUENBMjAxMV8yMDExLTA3LTA4LmNydDAMBgNV
// SIG // HRMBAf8EAjAAMA0GCSqGSIb3DQEBCwUAA4ICAQCI5g/S
// SIG // KUFb3wdUHob6Qhnu0Hk0JCkO4925gzI8EqhS+K4umnvS
// SIG // BU3acsJ+bJprUiMimA59/5x7WhJ9F9TQYy+aD9AYwMtb
// SIG // KsQ/rst+QflfML+Rq8YTAyT/JdkIy7R/1IJUkyIS6srf
// SIG // G1AKlX8n6YeAjjEb8MI07wobQp1F1wArgl2B1mpTqHND
// SIG // lNqBjfpjySCScWjUHNbIwbDGxiFr93JoEh5AhJqzL+8m
// SIG // onaXj7elfsjzIpPnl8NyH2eXjTojYC9a2c4EiX0571Ko
// SIG // mhENF3RtR25A7/X7+gk6upuE8tyMy4sBkl2MUSF08U+E
// SIG // 2LOVcR8trhYxV1lUi9CdgEU2CxODspdcFwxdT1+G8YNc
// SIG // gzHyjx3BNSI4nOZcdSnStUpGhCXbaOIXfvtOSfQX/UwJ
// SIG // oruhCugvTnub0Wna6CQiturglCOMyIy/6hu5rMFvqk9A
// SIG // ltIJ0fSR5FwljW6PHHDJNbCWrZkaEgIn24M2mG1M/Ppb
// SIG // /iF8uRhbgJi5zWxo2nAdyDBqWvpWxYIoee/3yIWpquVY
// SIG // cYGhJp/1I1sq/nD4gBVrk1SKX7Do2xAMMO+cFETTNSJq
// SIG // fTSSsntTtuBLKRB5mw5qglHKuzapDiiBuD1Zt4QwxA/1
// SIG // kKcyQ5L7uBayG78kxlVNNbyrIOFH3HYmdH0Pv1dIX/Mq
// SIG // 7avQpAfIiLpOWwcbjzCCB3owggVioAMCAQICCmEOkNIA
// SIG // AAAAAAMwDQYJKoZIhvcNAQELBQAwgYgxCzAJBgNVBAYT
// SIG // AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
// SIG // EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
// SIG // cG9yYXRpb24xMjAwBgNVBAMTKU1pY3Jvc29mdCBSb290
// SIG // IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDExMB4XDTEx
// SIG // MDcwODIwNTkwOVoXDTI2MDcwODIxMDkwOVowfjELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEoMCYGA1UEAxMfTWljcm9zb2Z0
// SIG // IENvZGUgU2lnbmluZyBQQ0EgMjAxMTCCAiIwDQYJKoZI
// SIG // hvcNAQEBBQADggIPADCCAgoCggIBAKvw+nIQHC6t2G6q
// SIG // ghBNNLrytlghn0IbKmvpWlCquAY4GgRJun/DDB7dN2vG
// SIG // EtgL8DjCmQawyDnVARQxQtOJDXlkh36UYCRsr55JnOlo
// SIG // XtLfm1OyCizDr9mpK656Ca/XllnKYBoF6WZ26DJSJhIv
// SIG // 56sIUM+zRLdd2MQuA3WraPPLbfM6XKEW9Ea64DhkrG5k
// SIG // NXimoGMPLdNAk/jj3gcN1Vx5pUkp5w2+oBN3vpQ97/vj
// SIG // K1oQH01WKKJ6cuASOrdJXtjt7UORg9l7snuGG9k+sYxd
// SIG // 6IlPhBryoS9Z5JA7La4zWMW3Pv4y07MDPbGyr5I4ftKd
// SIG // gCz1TlaRITUlwzluZH9TupwPrRkjhMv0ugOGjfdf8NBS
// SIG // v4yUh7zAIXQlXxgotswnKDglmDlKNs98sZKuHCOnqWbs
// SIG // YR9q4ShJnV+I4iVd0yFLPlLEtVc/JAPw0XpbL9Uj43Bd
// SIG // D1FGd7P4AOG8rAKCX9vAFbO9G9RVS+c5oQ/pI0m8GLhE
// SIG // fEXkwcNyeuBy5yTfv0aZxe/CHFfbg43sTUkwp6uO3+xb
// SIG // n6/83bBm4sGXgXvt1u1L50kppxMopqd9Z4DmimJ4X7Iv
// SIG // hNdXnFy/dygo8e1twyiPLI9AN0/B4YVEicQJTMXUpUMv
// SIG // dJX3bvh4IFgsE11glZo+TzOE2rCIF96eTvSWsLxGoGyY
// SIG // 0uDWiIwLAgMBAAGjggHtMIIB6TAQBgkrBgEEAYI3FQEE
// SIG // AwIBADAdBgNVHQ4EFgQUSG5k5VAF04KqFzc3IrVtqMp1
// SIG // ApUwGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYD
// SIG // VR0PBAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0j
// SIG // BBgwFoAUci06AjGQQ7kUBU7h6qfHMdEjiTQwWgYDVR0f
// SIG // BFMwUTBPoE2gS4ZJaHR0cDovL2NybC5taWNyb3NvZnQu
// SIG // Y29tL3BraS9jcmwvcHJvZHVjdHMvTWljUm9vQ2VyQXV0
// SIG // MjAxMV8yMDExXzAzXzIyLmNybDBeBggrBgEFBQcBAQRS
// SIG // MFAwTgYIKwYBBQUHMAKGQmh0dHA6Ly93d3cubWljcm9z
// SIG // b2Z0LmNvbS9wa2kvY2VydHMvTWljUm9vQ2VyQXV0MjAx
// SIG // MV8yMDExXzAzXzIyLmNydDCBnwYDVR0gBIGXMIGUMIGR
// SIG // BgkrBgEEAYI3LgMwgYMwPwYIKwYBBQUHAgEWM2h0dHA6
// SIG // Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvZG9jcy9w
// SIG // cmltYXJ5Y3BzLmh0bTBABggrBgEFBQcCAjA0HjIgHQBM
// SIG // AGUAZwBhAGwAXwBwAG8AbABpAGMAeQBfAHMAdABhAHQA
// SIG // ZQBtAGUAbgB0AC4gHTANBgkqhkiG9w0BAQsFAAOCAgEA
// SIG // Z/KGpZjgVHkaLtPYdGcimwuWEeFjkplCln3SeQyQwWVf
// SIG // Liw++MNy0W2D/r4/6ArKO79HqaPzadtjvyI1pZddZYSQ
// SIG // fYtGUFXYDJJ80hpLHPM8QotS0LD9a+M+By4pm+Y9G6XU
// SIG // tR13lDni6WTJRD14eiPzE32mkHSDjfTLJgJGKsKKELuk
// SIG // qQUMm+1o+mgulaAqPyprWEljHwlpblqYluSD9MCP80Yr
// SIG // 3vw70L01724lruWvJ+3Q3fMOr5kol5hNDj0L8giJ1h/D
// SIG // Mhji8MUtzluetEk5CsYKwsatruWy2dsViFFFWDgycSca
// SIG // f7H0J/jeLDogaZiyWYlobm+nt3TDQAUGpgEqKD6CPxNN
// SIG // ZgvAs0314Y9/HG8VfUWnduVAKmWjw11SYobDHWM2l4bf
// SIG // 2vP48hahmifhzaWX0O5dY0HjWwechz4GdwbRBrF1HxS+
// SIG // YWG18NzGGwS+30HHDiju3mUv7Jf2oVyW2ADWoUa9WfOX
// SIG // pQlLSBCZgB/QACnFsZulP0V3HjXG0qKin3p6IvpIlR+r
// SIG // +0cjgPWe+L9rt0uX4ut1eBrs6jeZeRhL/9azI2h15q/6
// SIG // /IvrC4DqaTuv/DDtBEyO3991bWORPdGdVk5Pv4BXIqF4
// SIG // ETIheu9BCrE/+6jMpF3BoYibV3FWTkhFwELJm3ZbCoBI
// SIG // a/15n8G9bW1qyVJzEw16UM0xghojMIIaHwIBATCBlTB+
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNy
// SIG // b3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAE
// SIG // BGx0Bv9XKydyAAAAAAQEMA0GCWCGSAFlAwQCAQUAoIGu
// SIG // MBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisG
// SIG // AQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3
// SIG // DQEJBDEiBCDDSrQ0p50RRXKvFpdwPfiWkUxdfftWhgrx
// SIG // FTj+mJXpXzBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAJqcLEld
// SIG // 2Bc9p2cW2SVQ3O+OT1dTfXQpeeTz6HpWPfblQgsTHY/G
// SIG // h1yWSqO0awsOuqQ66xL6QV13hyRF386tvTbPZktg7lX8
// SIG // PSXZDZKTMCucbWgsc4I5OC3fNy4UxnQty3mVk4gwXtr1
// SIG // PXdb9SnDeEeOwyraZ7sBMpBoqDQw1Tfv5ETWt0AY0VMX
// SIG // Vup7MxvyYJvC5YY3oJ83gR222nXigNu20MUU5KZEhJYc
// SIG // qfpJvQlfsX+2wrl55ZoQwrytye2VX3hp58pDSmh50Vtg
// SIG // bf+fQX3VHI3fMgYrGdRHKnHsQ51jpC13Uc6FSKDu51nT
// SIG // YoLw7JmOhwriWEKDtBkYWPC50pShghetMIIXqQYKKwYB
// SIG // BAGCNwMDATGCF5kwgheVBgkqhkiG9w0BBwKggheGMIIX
// SIG // ggIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBWgYLKoZIhvcN
// SIG // AQkQAQSgggFJBIIBRTCCAUECAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQgCGjQswCefHam4TlnrRrp
// SIG // M9TQ2i2o4Z8WHMX268jxAroCBmftTx9YHRgTMjAyNTA0
// SIG // MTYwMTA1MjYuMTQ4WjAEgAIB9KCB2aSB1jCB0zELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYD
// SIG // VQQLEx5uU2hpZWxkIFRTUyBFU046NjUxQS0wNUUwLUQ5
// SIG // NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
// SIG // IFNlcnZpY2WgghH7MIIHKDCCBRCgAwIBAgITMwAAAfWZ
// SIG // CZS88cZQjAABAAAB9TANBgkqhkiG9w0BAQsFADB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNDA3MjUx
// SIG // ODMxMDFaFw0yNTEwMjIxODMxMDFaMIHTMQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMS0wKwYDVQQLEyRNaWNyb3NvZnQgSXJl
// SIG // bGFuZCBPcGVyYXRpb25zIExpbWl0ZWQxJzAlBgNVBAsT
// SIG // Hm5TaGllbGQgVFNTIEVTTjo2NTFBLTA1RTAtRDk0NzEl
// SIG // MCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
// SIG // dmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
// SIG // ggIBAMzvdHBUE1nf1j/OCE+yTCFtX0C+tbHX4JoZX09J
// SIG // 72BG9pL5DRdO92cI73rklqLd/Oy4xNEwohvd3uiNB8yB
// SIG // UAZ28Rj/1jwVIqxau1hOUQLLoTX2FC/jyG/YyatwsFsS
// SIG // An8Obf6U8iDh4yr6NZUDk1mcqYq/6bGcBBO8trlgD22S
// SIG // Uxaynp+Ue98dh28cuHltQ3Jl48ptsBVr9dLAR+NGoyX3
// SIG // vjpMHE3aGK2NypKTf0UEo3snCtG4Y6NAhmCGGvmTAGqN
// SIG // EjUf0dSdWOrC5IgiTt2kK20tUs+5fv6iYMvH8hGTDQ+T
// SIG // LOwtLBGjr6AR4lkqUzOL3NMQywpnOjxr9NwrVrtiosqq
// SIG // y/AQAdRGMjkoSNyE+/WqwyA6y/nXvdRX45kmwWOY/h70
// SIG // tJd3V5Iz9x6J/G++JVsIpBdK8xKxdJ95IVQLrMe0ptaB
// SIG // hvtOoc/VwMt1qLvk+knuqGuSw4kID031kf4/RTZPCbtO
// SIG // qEn04enNN1dLpZWtCMMvh81JflpmMRS1ND4ml7JoLnTc
// SIG // Fap+dc6/gYt1zyfOcFrsuhhk+5wQ5lzc0zZMyvfAwUI0
// SIG // zmm0F1GfPOGG/QxTXIoJnlU2JMlF2eobHHfDcquOQNw9
// SIG // 25Pp157KICtWe82Y+l2xn7e8YDmL73lOqdPn67YWxezF
// SIG // 7/ouanA/R3xZjquFWB3r1XrGG+j9AgMBAAGjggFJMIIB
// SIG // RTAdBgNVHQ4EFgQUVeB8W/VKNKBw8CWSXttosXtgdQEw
// SIG // HwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIw
// SIG // XwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIw
// SIG // VGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwG
// SIG // CCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9N
// SIG // aWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAx
// SIG // MCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUBAf8E
// SIG // DDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJ
// SIG // KoZIhvcNAQELBQADggIBAHMMZlT2gPcR337qJtEzkqdo
// SIG // bKbn9RtHB1vylxwLoZ6VvP0r5auY/WiiP/PxunxiEDK9
// SIG // M5aWrvI8vNyOM3JRnSY5eUtNksQ5VCmsLVr4H+4nWtOj
// SIG // 4I3kDNXl+C7reG2z309BRKe+xu+oYcrF8UyTR7+cvn8E
// SIG // 4VHoonJYoWcKnGTKWuOpvqFeooE1OiNBJ53qLTKhbNEN
// SIG // 8x4FVa+Fl45xtgXJ5IqeNnncoP/Yl3M6kwaxJL089FJZ
// SIG // baRRmkJy86vjaPFRIKtFBu1tRC2RoZpsRZhwAcE0+rDy
// SIG // RVevA3y6AtIgfUG2/VWfJr201eSbSEgZJU7lQJRJM14v
// SIG // SyIzZsfpJ3QXyj/HcRv8W0V6bUA0A2grEuqIC5MC4B+s
// SIG // 0rPrpfVpsyNBfMyJm4Z2YVM4iB4XhaOB/maKIz2HIEyu
// SIG // v925Emzmm5kBX/eQfAenuVql20ubPTnTHVJVtYEyNa+b
// SIG // vlgMB9ihu3cZ3qE23/42Jd01LT+wB6cnJNnNJ7p/0NAs
// SIG // nKWvUFB/w8tNZOrUKJjVxo4r4NvwRnIGSdB8PAuilXpR
// SIG // Cd9cS6BNtZvfjRIEigkaBRNS5Jmt9UsiGsp23WBG/LDp
// SIG // WcpzHZvMj5XQ8LheeLyYhAK463AzV3ugaG2VIk1kir79
// SIG // QyWnUdUlAjvzndtRoFPoWarvnSoIygGHXkyL4vUdq7S2
// SIG // MIIHcTCCBVmgAwIBAgITMwAAABXF52ueAptJmQAAAAAA
// SIG // FTANBgkqhkiG9w0BAQsFADCBiDELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEyMDAGA1UEAxMpTWljcm9zb2Z0IFJvb3QgQ2Vy
// SIG // dGlmaWNhdGUgQXV0aG9yaXR5IDIwMTAwHhcNMjEwOTMw
// SIG // MTgyMjI1WhcNMzAwOTMwMTgzMjI1WjB8MQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGlt
// SIG // ZS1TdGFtcCBQQ0EgMjAxMDCCAiIwDQYJKoZIhvcNAQEB
// SIG // BQADggIPADCCAgoCggIBAOThpkzntHIhC3miy9ckeb0O
// SIG // 1YLT/e6cBwfSqWxOdcjKNVf2AX9sSuDivbk+F2Az/1xP
// SIG // x2b3lVNxWuJ+Slr+uDZnhUYjDLWNE893MsAQGOhgfWpS
// SIG // g0S3po5GawcU88V29YZQ3MFEyHFcUTE3oAo4bo3t1w/Y
// SIG // JlN8OWECesSq/XJprx2rrPY2vjUmZNqYO7oaezOtgFt+
// SIG // jBAcnVL+tuhiJdxqD89d9P6OU8/W7IVWTe/dvI2k45GP
// SIG // sjksUZzpcGkNyjYtcI4xyDUoveO0hyTD4MmPfrVUj9z6
// SIG // BVWYbWg7mka97aSueik3rMvrg0XnRm7KMtXAhjBcTyzi
// SIG // YrLNueKNiOSWrAFKu75xqRdbZ2De+JKRHh09/SDPc31B
// SIG // mkZ1zcRfNN0Sidb9pSB9fvzZnkXftnIv231fgLrbqn42
// SIG // 7DZM9ituqBJR6L8FA6PRc6ZNN3SUHDSCD/AQ8rdHGO2n
// SIG // 6Jl8P0zbr17C89XYcz1DTsEzOUyOArxCaC4Q6oRRRuLR
// SIG // vWoYWmEBc8pnol7XKHYC4jMYctenIPDC+hIK12NvDMk2
// SIG // ZItboKaDIV1fMHSRlJTYuVD5C4lh8zYGNRiER9vcG9H9
// SIG // stQcxWv2XFJRXRLbJbqvUAV6bMURHXLvjflSxIUXk8A8
// SIG // FdsaN8cIFRg/eKtFtvUeh17aj54WcmnGrnu3tz5q4i6t
// SIG // AgMBAAGjggHdMIIB2TASBgkrBgEEAYI3FQEEBQIDAQAB
// SIG // MCMGCSsGAQQBgjcVAgQWBBQqp1L+ZMSavoKRPEY1Kc8Q
// SIG // /y8E7jAdBgNVHQ4EFgQUn6cVXQBeYl2D9OXSZacbUzUZ
// SIG // 6XIwXAYDVR0gBFUwUzBRBgwrBgEEAYI3TIN9AQEwQTA/
// SIG // BggrBgEFBQcCARYzaHR0cDovL3d3dy5taWNyb3NvZnQu
// SIG // Y29tL3BraW9wcy9Eb2NzL1JlcG9zaXRvcnkuaHRtMBMG
// SIG // A1UdJQQMMAoGCCsGAQUFBwMIMBkGCSsGAQQBgjcUAgQM
// SIG // HgoAUwB1AGIAQwBBMAsGA1UdDwQEAwIBhjAPBgNVHRMB
// SIG // Af8EBTADAQH/MB8GA1UdIwQYMBaAFNX2VsuP6KJcYmjR
// SIG // PZSQW9fOmhjEMFYGA1UdHwRPME0wS6BJoEeGRWh0dHA6
// SIG // Ly9jcmwubWljcm9zb2Z0LmNvbS9wa2kvY3JsL3Byb2R1
// SIG // Y3RzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNybDBa
// SIG // BggrBgEFBQcBAQROMEwwSgYIKwYBBQUHMAKGPmh0dHA6
// SIG // Ly93d3cubWljcm9zb2Z0LmNvbS9wa2kvY2VydHMvTWlj
// SIG // Um9vQ2VyQXV0XzIwMTAtMDYtMjMuY3J0MA0GCSqGSIb3
// SIG // DQEBCwUAA4ICAQCdVX38Kq3hLB9nATEkW+Geckv8qW/q
// SIG // XBS2Pk5HZHixBpOXPTEztTnXwnE2P9pkbHzQdTltuw8x
// SIG // 5MKP+2zRoZQYIu7pZmc6U03dmLq2HnjYNi6cqYJWAAOw
// SIG // Bb6J6Gngugnue99qb74py27YP0h1AdkY3m2CDPVtI1Tk
// SIG // eFN1JFe53Z/zjj3G82jfZfakVqr3lbYoVSfQJL1AoL8Z
// SIG // thISEV09J+BAljis9/kpicO8F7BUhUKz/AyeixmJ5/AL
// SIG // aoHCgRlCGVJ1ijbCHcNhcy4sa3tuPywJeBTpkbKpW99J
// SIG // o3QMvOyRgNI95ko+ZjtPu4b6MhrZlvSP9pEB9s7GdP32
// SIG // THJvEKt1MMU0sHrYUP4KWN1APMdUbZ1jdEgssU5HLcEU
// SIG // BHG/ZPkkvnNtyo4JvbMBV0lUZNlz138eW0QBjloZkWsN
// SIG // n6Qo3GcZKCS6OEuabvshVGtqRRFHqfG3rsjoiV5PndLQ
// SIG // THa1V1QJsWkBRH58oWFsc/4Ku+xBZj1p/cvBQUl+fpO+
// SIG // y/g75LcVv7TOPqUxUYS8vwLBgqJ7Fx0ViY1w/ue10Cga
// SIG // iQuPNtq6TPmb/wrpNPgkNWcr4A245oyZ1uEi6vAnQj0l
// SIG // lOZ0dFtq0Z4+7X6gMTN9vMvpe784cETRkPHIqzqKOghi
// SIG // f9lwY1NNje6CbaUFEMFxBmoQtB1VM1izoXBm8qGCA1Yw
// SIG // ggI+AgEBMIIBAaGB2aSB1jCB0zELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQg
// SIG // T3BlcmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5uU2hp
// SIG // ZWxkIFRTUyBFU046NjUxQS0wNUUwLUQ5NDcxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wi
// SIG // IwoBATAHBgUrDgMCGgMVACbACruPDW0eWEYN1kgUAso8
// SIG // 3ZL2oIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwDQYJKoZIhvcNAQELBQACBQDrqPBCMCIYDzIw
// SIG // MjUwNDE1MTQ0ODM0WhgPMjAyNTA0MTYxNDQ4MzRaMHQw
// SIG // OgYKKwYBBAGEWQoEATEsMCowCgIFAOuo8EICAQAwBwIB
// SIG // AAICL6cwBwIBAAICE0UwCgIFAOuqQcICAQAwNgYKKwYB
// SIG // BAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgCAQAC
// SIG // AwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOC
// SIG // AQEAKwZuGsv8Vb1HfytnQRvdK9rj7zRKcW/RYYTpwUJ+
// SIG // zFN353fpKjJJZBbywEKG1ZTRX4x1dq9hzFUcy2I28Fg6
// SIG // gAaS5xwd5Mtv4tx0g52IZSmiCjwlUjQfUznUB4WA0jrm
// SIG // p/cXxsp/5xRLpYP82CFJZKZa91QqnfDZv/lsKGlnYQl+
// SIG // LkN2vQ43kR76xLoywN/2T6d8JomebStqD6yzGAhpk4R8
// SIG // a6VWQrI7yrHPhwAoqbIx+UIFYBKfj5hqV4LQbYxPoo6I
// SIG // uSCD8V6lkXXLIbGKyk47eoZjQenH+iKHdOBcziKO9r9a
// SIG // GkORtiLxsQokQsI5GrBkze2wagbsl8aPTbB0ATGCBA0w
// SIG // ggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAk
// SIG // BgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
// SIG // MDEwAhMzAAAB9ZkJlLzxxlCMAAEAAAH1MA0GCWCGSAFl
// SIG // AwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcN
// SIG // AQkQAQQwLwYJKoZIhvcNAQkEMSIEIOMZ5Q7CST/EPsng
// SIG // 7Z0r3xX9+BzNNTs6qaUK/O1Tt1L7MIH6BgsqhkiG9w0B
// SIG // CRACLzGB6jCB5zCB5DCBvQQgwdby0hcIdPSEruJHRL+P
// SIG // 7YPXkdWJPMOce4+Rk4amjzUwgZgwgYCkfjB8MQswCQYD
// SIG // VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
// SIG // A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
// SIG // IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAfWZCZS88cZQ
// SIG // jAABAAAB9TAiBCBTvTnPmezxI6kXltrwnl8+NXq+MUoN
// SIG // 3kyb/zq9pECeRTANBgkqhkiG9w0BAQsFAASCAgAnlCEd
// SIG // mJhGJb0Hvzim0UurhGhk5Dqt6XBnQV7OwTTQBeJQ8jMd
// SIG // sgMFGC2Fpm7WeAjqPxsXwy7P0KxKzdAFX4wLiybccDvK
// SIG // dquLaq0XDlme0CVZsQiArXNL6OPmgTFnOp1T8n2dNGyx
// SIG // 5nY/bfyUVPaKKyrexaEvcGM38OENW5G/Sabdihe3ouSK
// SIG // zFA6fjDTnEsMfi1mvgAE+S8hD7eDKd7bloUBFDb9C8oW
// SIG // jYF9lvlNjrqukAX9ehnYVcSihDxmh9kwbemiJ4ogMetu
// SIG // gwjvdGsiJ+hwOBgD6F2X0lj1MEEFZwXI48GQHepN3TcR
// SIG // pWsHRdroXC+GZ7IVMAn9+ZuO4lLJi5Gpe2rZageySOyh
// SIG // 9mP7aQTIyyL8k01mSb8qwfdSw1SwVeQJyiBk1mXiHl0e
// SIG // TYBL0RkDva1Q0tjw2SZdZ+y7AZGp0vXhp32D7pUTUOMh
// SIG // Chb3F4byllgxRDul/dmt1fFul0Oe2zvgBdR/D5Cb6XNL
// SIG // DQJa2/5c1JiRJigvUiEEPvHrU+BMOOEDXJkSJlAk5lGE
// SIG // gUpSWbXC/lDYsdCyNwtmQWxbQ8SA0BY96RtppoGcDhs9
// SIG // THpd2N5z4nnLVPS91YWPy6oZFXkcAyCJZvvMlq26eJRX
// SIG // gxFDq3gC+7F5Qd7wnSM51DI7eyNxbA4KtdTYf8A9co3p
// SIG // OD5+fA6hbW9eZZVabQ==
// SIG // End signature block
