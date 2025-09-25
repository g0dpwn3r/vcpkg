"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataFile = void 0;
const path_1 = require("path");
const yaml_1 = require("yaml");
const i18n_1 = require("../i18n");
const error_kind_1 = require("../interfaces/error-kind");
const BaseMap_1 = require("../yaml/BaseMap");
const Options_1 = require("../yaml/Options");
const contact_1 = require("./contact");
const demands_1 = require("./demands");
const info_1 = require("./info");
const registries_1 = require("./registries");
class MetadataFile extends BaseMap_1.BaseMap {
    document;
    filename;
    file;
    lineCounter;
    registryUri;
    constructor(document, filename, file, lineCounter, registryUri) {
        super(document.contents);
        this.document = document;
        this.filename = filename;
        this.file = file;
        this.lineCounter = lineCounter;
        this.registryUri = registryUri;
    }
    static async parseMetadata(filename, uri, session, registryUri) {
        return MetadataFile.parseConfiguration(filename, await uri.readUTF8(), session, registryUri);
    }
    static async parseConfiguration(filename, content, session, registryUri) {
        const lc = new yaml_1.LineCounter();
        if (!content || content === 'null') {
            content = '{\n}';
        }
        const doc = (0, yaml_1.parseDocument)(content, { prettyErrors: false, lineCounter: lc, strict: true });
        return new MetadataFile(doc, filename, session.fileSystem.file((0, path_1.resolve)(filename)), lc, registryUri);
    }
    #info = new info_1.Info(undefined, this, 'info');
    contacts = new contact_1.Contacts(undefined, this, 'contacts');
    registries = new registries_1.RegistriesDeclaration(undefined, this, 'registries');
    // rather than re-implement it, use encapsulation with a demand block
    demandBlock = new demands_1.DemandBlock(this.node, undefined);
    /** Artifact identity
   *
   * this should be the 'path' to the artifact (following the guidelines)
   *
   * ie, 'compilers/microsoft/msvc'
   *
   * artifacts install to artifacts-root/<source>/<id>/<VER>
   */
    get id() { return this.asString(this.getMember('id')) || this.#info.id || ''; }
    set id(value) { this.normalize(); this.setMember('id', value); }
    /** the version of this artifact */
    get version() { return this.asString(this.getMember('version')) || this.#info.version || ''; }
    set version(value) { this.normalize(); this.setMember('version', value); }
    /** a short 1 line descriptive text */
    get summary() { return this.asString(this.getMember('summary')) || this.#info.summary; }
    set summary(value) { this.normalize(); this.setMember('summary', value); }
    /** if a longer description is required, the value should go here */
    get description() { return this.asString(this.getMember('description')) || this.#info.description; }
    set description(value) { this.normalize(); this.setMember('description', value); }
    #options = new Options_1.Options(undefined, this, 'options');
    /** if true, intended to be used only as a dependency; for example, do not show in search results or lists */
    get dependencyOnly() { return this.#options.has('dependencyOnly') || this.#info.options.has('dependencyOnly'); }
    get espidf() { return this.#options.has('espidf') || this.#info.options.has('espidf'); }
    /** higher priority artifacts should install earlier; the default is zero */
    get priority() { return this.asNumber(this.getMember('priority')) || this.#info.priority || 0; }
    set priority(value) { this.normalize(); this.setMember('priority', value); }
    get error() { return this.demandBlock.error; }
    set error(value) { this.demandBlock.error = value; }
    get warning() { return this.demandBlock.warning; }
    set warning(value) { this.demandBlock.warning = value; }
    get message() { return this.demandBlock.message; }
    set message(value) { this.demandBlock.message = value; }
    get requires() { return this.demandBlock.requires; }
    get exports() { return this.demandBlock.exports; }
    get install() { return this.demandBlock.install; }
    conditionalDemands = new demands_1.Demands(undefined, this, 'demands');
    get isFormatValid() {
        return this.document.errors.length === 0;
    }
    toJsonString() {
        let content = JSON.stringify(this.document.toJSON(), null, 2);
        if (!content || content === 'null') {
            content = '{}\n';
        }
        return content;
    }
    async save(uri = this.file) {
        await uri.writeUTF8(this.toJsonString());
    }
    #errors;
    get formatErrors() {
        const t = this;
        return this.#errors || (this.#errors = this.document.errors.map(each => {
            const message = each.message;
            const line = each.linePos?.[0].line || 1;
            const column = each.linePos?.[0].col || 1;
            return t.formatMessage(each.name, message, line, column);
        }));
    }
    /** @internal */ formatMessage(category, message, line, column) {
        if (line !== undefined && column !== undefined) {
            return `${this.filename}:${line}:${column} ${category}, ${message}`;
        }
        else {
            return `${this.filename}: ${category}, ${message}`;
        }
    }
    formatVMessage(vMessage) {
        const message = vMessage.message;
        const range = vMessage.range;
        const rangeOffset = vMessage.rangeOffset;
        const category = vMessage.category;
        const r = Array.isArray(range) ? range : range?.sourcePosition();
        const { line, column } = this.positionAt(r, rangeOffset);
        return this.formatMessage(category, message, line, column);
    }
    *deprecationWarnings() {
        const node = this.node;
        if (node) {
            const info = node.get('info');
            if (info) {
                const infoNode = info;
                yield {
                    message: (0, i18n_1.i) `The info block is deprecated for consistency with vcpkg.json; move info members to the outside.`,
                    range: infoNode.range || undefined,
                    category: error_kind_1.ErrorKind.InfoBlockPresent
                };
            }
        }
    }
    positionAt(range, offset) {
        const { line, col } = this.lineCounter.linePos(range?.[0] || 0);
        return offset ? {
            // adds the offset values (which can come from the mediaquery parser) to the line & column. If MQ doesn't have a position, it's zero.
            line: line + (offset.line - 1),
            column: col + (offset.column - 1),
        } :
            {
                line, column: col
            };
    }
    /** @internal */
    *validate() {
        yield* super.validate();
        const hasInfo = this.document.has('info');
        const allowedChildren = ['contacts', 'registries', 'demands', 'exports', 'requires', 'install'];
        if (hasInfo) {
            // 2022-06-17 and earlier used a separate 'info' block for these fields
            allowedChildren.push('info');
        }
        else {
            allowedChildren.push('version', 'id', 'summary', 'priority', 'description', 'options');
        }
        yield* this.validateChildKeys(allowedChildren);
        if (hasInfo) {
            yield* this.#info.validate();
        }
        else {
            if (!this.has('id')) {
                yield { message: (0, i18n_1.i) `Missing identity '${'id'}'`, range: this, category: error_kind_1.ErrorKind.FieldMissing };
            }
            else if (!this.childIs('id', 'string')) {
                yield { message: (0, i18n_1.i) `id should be of type 'string', found '${this.kind('id')}'`, range: this.sourcePosition('id'), category: error_kind_1.ErrorKind.IncorrectType };
            }
            if (!this.has('version')) {
                yield { message: (0, i18n_1.i) `Missing version '${'version'}'`, range: this, category: error_kind_1.ErrorKind.FieldMissing };
            }
            else if (!this.childIs('version', 'string')) {
                yield { message: (0, i18n_1.i) `version should be of type 'string', found '${this.kind('version')}'`, range: this.sourcePosition('version'), category: error_kind_1.ErrorKind.IncorrectType };
            }
            if (this.childIs('summary', 'string') === false) {
                yield { message: (0, i18n_1.i) `summary should be of type 'string', found '${this.kind('summary')}'`, range: this.sourcePosition('summary'), category: error_kind_1.ErrorKind.IncorrectType };
            }
            if (this.childIs('description', 'string') === false) {
                yield { message: (0, i18n_1.i) `description should be of type 'string', found '${this.kind('description')}'`, range: this.sourcePosition('description'), category: error_kind_1.ErrorKind.IncorrectType };
            }
            if (this.childIs('options', 'sequence') === false) {
                yield { message: (0, i18n_1.i) `options should be a sequence, found '${this.kind('options')}'`, range: this.sourcePosition('options'), category: error_kind_1.ErrorKind.IncorrectType };
            }
        }
        if (this.document.has('contacts')) {
            for (const each of this.contacts.values) {
                yield* each.validate();
            }
        }
        const set = new Set();
        for (const [mediaQuery, demandBlock] of this.conditionalDemands) {
            if (set.has(mediaQuery)) {
                yield { message: (0, i18n_1.i) `Duplicate keys detected in manifest: '${mediaQuery}'`, range: demandBlock, category: error_kind_1.ErrorKind.DuplicateKey };
            }
            set.add(mediaQuery);
            yield* demandBlock.validate();
        }
        yield* this.conditionalDemands.validate();
        yield* this.install.validate();
        yield* this.registries.validate();
        yield* this.contacts.validate();
        yield* this.exports.validate();
        yield* this.requires.validate();
    }
    normalize() {
        if (!this.node) {
            return;
        }
        if (this.document.has('info')) {
            this.setMember('id', this.#info.id);
            this.setMember('version', this.#info.version);
            this.setMember('summary', this.#info.summary);
            this.setMember('description', this.#info.description);
            const maybeOptions = this.#info.options.node?.items;
            if (maybeOptions) {
                for (const option of maybeOptions) {
                    this.#options.set(option.value, true);
                }
            }
            this.setMember('priority', this.#info.priority);
            this.node.delete('info');
        }
    }
    /** @internal */ assert(recreateIfDisposed = false, node = this.node) {
        if (!(0, yaml_1.isMap)(this.node)) {
            this.document = (0, yaml_1.parseDocument)('{}\n', { prettyErrors: false, lineCounter: this.lineCounter, strict: true });
            this.node = this.document.contents;
        }
    }
}
exports.MetadataFile = MetadataFile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YWRhdGEtZmlsZS5qcyIsInNvdXJjZVJvb3QiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vbWljcm9zb2Z0L3ZjcGtnLXRvb2wvbWFpbi92Y3BrZy1hcnRpZmFjdHMvIiwic291cmNlcyI6WyJhbWYvbWV0YWRhdGEtZmlsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsdUNBQXVDO0FBQ3ZDLGtDQUFrQzs7O0FBRWxDLCtCQUErQjtBQUMvQiwrQkFBNEU7QUFDNUUsa0NBQTRCO0FBQzVCLHlEQUFxRDtBQUlyRCw2Q0FBMEM7QUFDMUMsNkNBQTBDO0FBRzFDLHVDQUFxQztBQUNyQyx1Q0FBaUQ7QUFDakQsaUNBQThCO0FBQzlCLDZDQUFxRDtBQUVyRCxNQUFhLFlBQWEsU0FBUSxpQkFBTztJQUNUO0lBQTJDO0lBQWtDO0lBQWtCO0lBQTBDO0lBQXZLLFlBQThCLFFBQXlCLEVBQWtCLFFBQWdCLEVBQWtCLElBQVMsRUFBUyxXQUF3QixFQUFrQixXQUE0QjtRQUNqTSxLQUFLLENBQTRCLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUR4QixhQUFRLEdBQVIsUUFBUSxDQUFpQjtRQUFrQixhQUFRLEdBQVIsUUFBUSxDQUFRO1FBQWtCLFNBQUksR0FBSixJQUFJLENBQUs7UUFBUyxnQkFBVyxHQUFYLFdBQVcsQ0FBYTtRQUFrQixnQkFBVyxHQUFYLFdBQVcsQ0FBaUI7SUFHbk0sQ0FBQztJQUVELE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFFBQWdCLEVBQUUsR0FBUSxFQUFFLE9BQWdCLEVBQUUsV0FBaUI7UUFDeEYsT0FBTyxZQUFZLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLE1BQU0sR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztJQUMvRixDQUFDO0lBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxRQUFnQixFQUFFLE9BQWUsRUFBRSxPQUFnQixF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
// SIG // Begin signature block
// SIG // MIIoKAYJKoZIhvcNAQcCoIIoGTCCKBUCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // 0BaF5S7XsolItjjgYFOG1KDqMK62Q10HzcczfZZGxNig
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
// SIG // a/15n8G9bW1qyVJzEw16UM0xghoKMIIaBgIBATCBlTB+
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNy
// SIG // b3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAE
// SIG // BGx0Bv9XKydyAAAAAAQEMA0GCWCGSAFlAwQCAQUAoIGu
// SIG // MBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisG
// SIG // AQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3
// SIG // DQEJBDEiBCC9oYV7CtNgLJs/5RDSIbxjWtUSymBWPp17
// SIG // v+uUaZLM9TBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAJ0orPnH
// SIG // 2qNLuiDWaHo0CgIO1ru22KaOAYm5e6DzmV6dEDSqEe1h
// SIG // 5y0tl/wt6arYCJrfAjIRPPDL//ImCzAZk/MNWYDztAwt
// SIG // wTp3u0EERUjnO6I/dud2YiOhFUR9Ochm2p3eQg7JFQWo
// SIG // gXJaKFfeawTpgFhBySMJHisKuPHA/Q/HST77E0K+VZV0
// SIG // 71/aBrC7JmJFFkh8XG4ceAifQaZ82XTXUwhMG6gZk6WK
// SIG // q8ACQLXkC+YU83yPKfBBELYtgvNU6BgAVds4+ron7AI5
// SIG // ZQFgtfdwQch02OnEq8ULvxXnK6aff+BJhN7aq1dkklbG
// SIG // YNU76Uyv0FV2ml8+nQKheWBPj4ChgheUMIIXkAYKKwYB
// SIG // BAGCNwMDATGCF4Awghd8BgkqhkiG9w0BBwKgghdtMIIX
// SIG // aQIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBUgYLKoZIhvcN
// SIG // AQkQAQSgggFBBIIBPTCCATkCAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQg732OeSM5YKwokD3QQQoJ
// SIG // L2oX0lbk+0ubQ6qMcjRGKv0CBmf31Vyr4BgTMjAyNTA0
// SIG // MTYwMTA1MDcuODY5WjAEgAIB9KCB0aSBzjCByzELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjElMCMGA1UECxMcTWljcm9zb2Z0
// SIG // IEFtZXJpY2EgT3BlcmF0aW9uczEnMCUGA1UECxMeblNo
// SIG // aWVsZCBUU1MgRVNOOkEwMDAtMDVFMC1EOTQ3MSUwIwYD
// SIG // VQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNl
// SIG // oIIR6jCCByAwggUIoAMCAQICEzMAAAIIeJ1YXZLH2VIA
// SIG // AQAAAggwDQYJKoZIhvcNAQELBQAwfDELMAkGA1UEBhMC
// SIG // VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
// SIG // B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
// SIG // b3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgUENBIDIwMTAwHhcNMjUwMTMwMTk0MjUzWhcN
// SIG // MjYwNDIyMTk0MjUzWjCByzELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjElMCMGA1UECxMcTWljcm9zb2Z0IEFtZXJpY2EgT3Bl
// SIG // cmF0aW9uczEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
// SIG // OkEwMDAtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBTZXJ2aWNlMIICIjANBgkqhkiG
// SIG // 9w0BAQEFAAOCAg8AMIICCgKCAgEAtctwCOZSM9yKdZyu
// SIG // QTFFGxkbI0pws/1RrN9872NDXrIbD4H5Xd/2d/93UvFi
// SIG // gS5Q5aLJlyTmZRUojV1Heg0ycQPYpP2WwnVie/Cyo2zd
// SIG // 7RZF9nOkUaUTKQPLKv6AW0a8j93PEP4MaSQChx8/HLkp
// SIG // +3sHwi85zZsapYk5N0OSx6s9j43mCg/3WyjAU9kwAFgL
// SIG // 7puM/x1yCerRXRqDVeFlEWbMAkrekTsGqkNaAGBrxJ3R
// SIG // /g12atfmx7IL3DzQnU0iKVqG0IiUv1Ci4kdNijQqgeCP
// SIG // cmoxU0pZzCBDM/zYud/KBiOuKYXLzaVHtvqmilh2fHeE
// SIG // 9SoIb0ZkkheGBeQzRCW8WglMLMu51C5rBZ02jo1TqExV
// SIG // ln1l7wbjipAXEClhir65Ive+o+MfuXswD9+n6t7unR0S
// SIG // Uy2QLuHRLjqKFN/pDGa/kQWFo0x0AilfsmdUk9HhpGx1
// SIG // 6ANpcskQ5TYwUHKHmSMVgmbbP3d/p39Y4kizen+sHR2l
// SIG // M9AA8Dk0P2hKNSAvOXhXj78iCmsRSZBlNjKmul86t6gq
// SIG // ubaJCB7Y4aILKxIHwyk3hV07XYZdSD7S3AnzHFjhhgF6
// SIG // LFVFOxvePBelveuNuH9lRw/C9xaMgCPfq+M8iEFJqohE
// SIG // s7kFnlqU04xWMApoF2hjrkg1fHDTlUAeiD8z53mYVU48
// SIG // MWwGZWkCAwEAAaOCAUkwggFFMB0GA1UdDgQWBBSjMeL3
// SIG // zqnFE4GDlQfX9fP5oXoBTTAfBgNVHSMEGDAWgBSfpxVd
// SIG // AF5iXYP05dJlpxtTNRnpcjBfBgNVHR8EWDBWMFSgUqBQ
// SIG // hk5odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3Bz
// SIG // L2NybC9NaWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENB
// SIG // JTIwMjAxMCgxKS5jcmwwbAYIKwYBBQUHAQEEYDBeMFwG
// SIG // CCsGAQUFBzAChlBodHRwOi8vd3d3Lm1pY3Jvc29mdC5j
// SIG // b20vcGtpb3BzL2NlcnRzL01pY3Jvc29mdCUyMFRpbWUt
// SIG // U3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNydDAMBgNVHRMB
// SIG // Af8EAjAAMBYGA1UdJQEB/wQMMAoGCCsGAQUFBwMIMA4G
// SIG // A1UdDwEB/wQEAwIHgDANBgkqhkiG9w0BAQsFAAOCAgEA
// SIG // UbMyiSsAH7MKnWkDxYmmAf2TQGFg2tONF03ELAmgrmuZ
// SIG // 7BtSLJWGkqR+5oky6+nkBKl3M2aKnjmv8bw5zBonxjXW
// SIG // tAh20MLaZyIbLrayjto4YxGhsJSYDjKpdta+yJOl5wc2
// SIG // tHt4QTruFAZDJfyxF/gFEbe4u/kUzbBjdHFz8D0m0xRP
// SIG // vc+1moBm2PacFKPzcZBibHqhgkP/StlTFO+G8OXu/vCB
// SIG // lITNsbKST6p0nhz4WJnAdFnJTsXFSH4/2bkL8KKz20xB
// SIG // GA1Qs0jd+3NMgoTzGOxSfhxhQTSccHeZSiK+xmH6vGtI
// SIG // DogtpYxmJXOK7eHAnndVyoPN39JfWlFYplgWF7XzXm4a
// SIG // X6+i3N4w/DYLKw4c7dFoJyHZ02Qou48Y7CAYpR/faWOf
// SIG // 4em0HCyivxOigj/RNWDe/Hy2jl5FzMjusS670Gfrgkot
// SIG // YXU7nxQu6EgfwlOUW3yFR1xtI9aNp9bZ3uHgmzXyqlD0
// SIG // xN9bTW1gUdt2IstK95EJh3mBNRi2y+KcJJ6moqdQUZ+l
// SIG // iFDCbYJ3GsBDd93/AGBmeGtzZx6KcxlVep3n3xlWoOE3
// SIG // bsvqMtWBfrIQoaF3TKn4T1haR3t7iRk+BiRIjbOPtvGv
// SIG // 8B1LhfmkWkdHDeT+15TsFNd+tIlAibUHbykGjQMBiNvS
// SIG // jsEt0Bq4kfRdozhj1AJaXhMwggdxMIIFWaADAgECAhMz
// SIG // AAAAFcXna54Cm0mZAAAAAAAVMA0GCSqGSIb3DQEBCwUA
// SIG // MIGIMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
// SIG // Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMV
// SIG // TWljcm9zb2Z0IENvcnBvcmF0aW9uMTIwMAYDVQQDEylN
// SIG // aWNyb3NvZnQgUm9vdCBDZXJ0aWZpY2F0ZSBBdXRob3Jp
// SIG // dHkgMjAxMDAeFw0yMTA5MzAxODIyMjVaFw0zMDA5MzAx
// SIG // ODMyMjVaMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpX
// SIG // YXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
// SIG // VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
// SIG // BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEw
// SIG // MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA
// SIG // 5OGmTOe0ciELeaLL1yR5vQ7VgtP97pwHB9KpbE51yMo1
// SIG // V/YBf2xK4OK9uT4XYDP/XE/HZveVU3Fa4n5KWv64NmeF
// SIG // RiMMtY0Tz3cywBAY6GB9alKDRLemjkZrBxTzxXb1hlDc
// SIG // wUTIcVxRMTegCjhuje3XD9gmU3w5YQJ6xKr9cmmvHaus
// SIG // 9ja+NSZk2pg7uhp7M62AW36MEBydUv626GIl3GoPz130
// SIG // /o5Tz9bshVZN7928jaTjkY+yOSxRnOlwaQ3KNi1wjjHI
// SIG // NSi947SHJMPgyY9+tVSP3PoFVZhtaDuaRr3tpK56KTes
// SIG // y+uDRedGbsoy1cCGMFxPLOJiss254o2I5JasAUq7vnGp
// SIG // F1tnYN74kpEeHT39IM9zfUGaRnXNxF803RKJ1v2lIH1+
// SIG // /NmeRd+2ci/bfV+AutuqfjbsNkz2K26oElHovwUDo9Fz
// SIG // pk03dJQcNIIP8BDyt0cY7afomXw/TNuvXsLz1dhzPUNO
// SIG // wTM5TI4CvEJoLhDqhFFG4tG9ahhaYQFzymeiXtcodgLi
// SIG // Mxhy16cg8ML6EgrXY28MyTZki1ugpoMhXV8wdJGUlNi5
// SIG // UPkLiWHzNgY1GIRH29wb0f2y1BzFa/ZcUlFdEtsluq9Q
// SIG // BXpsxREdcu+N+VLEhReTwDwV2xo3xwgVGD94q0W29R6H
// SIG // XtqPnhZyacaue7e3PmriLq0CAwEAAaOCAd0wggHZMBIG
// SIG // CSsGAQQBgjcVAQQFAgMBAAEwIwYJKwYBBAGCNxUCBBYE
// SIG // FCqnUv5kxJq+gpE8RjUpzxD/LwTuMB0GA1UdDgQWBBSf
// SIG // pxVdAF5iXYP05dJlpxtTNRnpcjBcBgNVHSAEVTBTMFEG
// SIG // DCsGAQQBgjdMg30BATBBMD8GCCsGAQUFBwIBFjNodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL0RvY3Mv
// SIG // UmVwb3NpdG9yeS5odG0wEwYDVR0lBAwwCgYIKwYBBQUH
// SIG // AwgwGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYD
// SIG // VR0PBAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0j
// SIG // BBgwFoAU1fZWy4/oolxiaNE9lJBb186aGMQwVgYDVR0f
// SIG // BE8wTTBLoEmgR4ZFaHR0cDovL2NybC5taWNyb3NvZnQu
// SIG // Y29tL3BraS9jcmwvcHJvZHVjdHMvTWljUm9vQ2VyQXV0
// SIG // XzIwMTAtMDYtMjMuY3JsMFoGCCsGAQUFBwEBBE4wTDBK
// SIG // BggrBgEFBQcwAoY+aHR0cDovL3d3dy5taWNyb3NvZnQu
// SIG // Y29tL3BraS9jZXJ0cy9NaWNSb29DZXJBdXRfMjAxMC0w
// SIG // Ni0yMy5jcnQwDQYJKoZIhvcNAQELBQADggIBAJ1Vffwq
// SIG // reEsH2cBMSRb4Z5yS/ypb+pcFLY+TkdkeLEGk5c9MTO1
// SIG // OdfCcTY/2mRsfNB1OW27DzHkwo/7bNGhlBgi7ulmZzpT
// SIG // Td2YurYeeNg2LpypglYAA7AFvonoaeC6Ce5732pvvinL
// SIG // btg/SHUB2RjebYIM9W0jVOR4U3UkV7ndn/OOPcbzaN9l
// SIG // 9qRWqveVtihVJ9AkvUCgvxm2EhIRXT0n4ECWOKz3+SmJ
// SIG // w7wXsFSFQrP8DJ6LGYnn8AtqgcKBGUIZUnWKNsIdw2Fz
// SIG // Lixre24/LAl4FOmRsqlb30mjdAy87JGA0j3mSj5mO0+7
// SIG // hvoyGtmW9I/2kQH2zsZ0/fZMcm8Qq3UwxTSwethQ/gpY
// SIG // 3UA8x1RtnWN0SCyxTkctwRQEcb9k+SS+c23Kjgm9swFX
// SIG // SVRk2XPXfx5bRAGOWhmRaw2fpCjcZxkoJLo4S5pu+yFU
// SIG // a2pFEUep8beuyOiJXk+d0tBMdrVXVAmxaQFEfnyhYWxz
// SIG // /gq77EFmPWn9y8FBSX5+k77L+DvktxW/tM4+pTFRhLy/
// SIG // AsGConsXHRWJjXD+57XQKBqJC4822rpM+Zv/Cuk0+CQ1
// SIG // ZyvgDbjmjJnW4SLq8CdCPSWU5nR0W2rRnj7tfqAxM328
// SIG // y+l7vzhwRNGQ8cirOoo6CGJ/2XBjU02N7oJtpQUQwXEG
// SIG // ahC0HVUzWLOhcGbyoYIDTTCCAjUCAQEwgfmhgdGkgc4w
// SIG // gcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5n
// SIG // dG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
// SIG // aWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNVBAsTHE1p
// SIG // Y3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNV
// SIG // BAsTHm5TaGllbGQgVFNTIEVTTjpBMDAwLTA1RTAtRDk0
// SIG // NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAg
// SIG // U2VydmljZaIjCgEBMAcGBSsOAwIaAxUAjZL7tDSnEo3W
// SIG // Csq4SWXLMlzlEzSggYMwgYCkfjB8MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1T
// SIG // dGFtcCBQQ0EgMjAxMDANBgkqhkiG9w0BAQsFAAIFAOuo
// SIG // 6uYwIhgPMjAyNTA0MTUxNDI1NDJaGA8yMDI1MDQxNjE0
// SIG // MjU0MlowdDA6BgorBgEEAYRZCgQBMSwwKjAKAgUA66jq
// SIG // 5gIBADAHAgEAAgIDIzAHAgEAAgISgzAKAgUA66o8ZgIB
// SIG // ADA2BgorBgEEAYRZCgQCMSgwJjAMBgorBgEEAYRZCgMC
// SIG // oAowCAIBAAIDB6EgoQowCAIBAAIDAYagMA0GCSqGSIb3
// SIG // DQEBCwUAA4IBAQAtAhNt2+uzA+9iddtrHBOBzdBiltmL
// SIG // ATFdjp9rH7umSQfFBjb9+a40Nwfah0DhS3kjczkbidnU
// SIG // kbPS3O/srUgrjVEpyVCspmCzbZMRpD+OY2z0E8EdI+vm
// SIG // r8gv4kf2c/BbAGYgpsPIfhmyBUvuvoaWCSXPLp2lGSOv
// SIG // kjhaJb9INDfMuBNkecFyyXhalTytWwoY6DLEi2DEPi/R
// SIG // gvkoTbmqQPmA6BAkTTcAulMNzsMzKvRb45jhrAU20uNW
// SIG // 4OXEytm7AOSOhrwYT5FLDqftWSQY0Po+EJhJTv2u2zjI
// SIG // Yv/arVlicCgoLWmcnGvzQh13gHwETG70LG+cjUEsvFGn
// SIG // OKQiMYIEDTCCBAkCAQEwgZMwfDELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3Rh
// SIG // bXAgUENBIDIwMTACEzMAAAIIeJ1YXZLH2VIAAQAAAggw
// SIG // DQYJYIZIAWUDBAIBBQCgggFKMBoGCSqGSIb3DQEJAzEN
// SIG // BgsqhkiG9w0BCRABBDAvBgkqhkiG9w0BCQQxIgQgHYNi
// SIG // DVmOiLei9s70P8VjKpz9lB+Di1EVumQgrmKyPiEwgfoG
// SIG // CyqGSIb3DQEJEAIvMYHqMIHnMIHkMIG9BCCP/45vCR2t
// SIG // ltTve+/LffhbdmeTZiqrbT5OkPvUUaZnqTCBmDCBgKR+
// SIG // MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5n
// SIG // dG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
// SIG // aWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1p
// SIG // Y3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMzAAAC
// SIG // CHidWF2Sx9lSAAEAAAIIMCIEIMWMLJrG6dOAiP3mG1TB
// SIG // AsTixzWZ0WwXsXTxQQipeMXaMA0GCSqGSIb3DQEBCwUA
// SIG // BIICAB9QbFtjfh+9pr3gzQpqNMWW9g/B5zKTjHpxjTAx
// SIG // J6sKH+xdvJ8xK/ShLAUh3fcVTarZb+XmNY0wrPH7LIpe
// SIG // BJ64bH5zS9s2cKe/TtS6dOnCUTU37Y8/DZzLS/L7rKKE
// SIG // wV7khOErHZHWFMq/Rxtsyvt0reghDScCaIDNtduzu0Ip
// SIG // 3uTNhxAJYjjecW3OiM1kWLdFDBzFHvioieHSCZJ9WYD1
// SIG // xKzOy4ycSM+AlOlV0KD0Q2uLHx6ifW91EvKWlXDz0HaC
// SIG // 0ggC7VO/xd6hmMJb7sbOUQk3TrZPcjLcLkrFpVx01pVy
// SIG // Zy+r4RDLQF1UwIyUPx4bSKoi/CR9ZTByDRf1Y5Jkb1gb
// SIG // t0Dz6tboNrXRmZZ+2ByAlOgJW3VQvcbfSUqtpsmctVkB
// SIG // AS2KJiZ3/jL1sYcKUJUIltU1y3bQVN3/r6HvLQagrg8K
// SIG // XVmw30S1gD9UJUKV2IX9jdHASVkWd/ExxAWr7sPm3kEe
// SIG // +P6OsRprGGk6p6A3/dPyvfuD+iQYSaF6TZccyLR0K7YN
// SIG // 8mzLo//ZZjox5y5+GcSHdr1yinFA1pshAXxr3DDgINJd
// SIG // 4Oi312BjIZekb7F1aWde8B46yXVZVL34ka08woy4kwlA
// SIG // 9tXBh06pZyQWvSGmd/UBHOIH6ADdmD7wqZai7MeZ4Cvk
// SIG // +p4QXRg+1DaYWtoKf3/gwqxZB6QR
// SIG // End signature block
