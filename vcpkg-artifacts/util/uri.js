"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFilePath = exports.Uri = void 0;
const assert_1 = require("assert");
const path_1 = require("path");
const url_1 = require("url");
const vscode_uri_1 = require("vscode-uri");
const hash_1 = require("./hash");
const text_1 = require("./text");
/**
 * This class is intended to be a drop-in replacement for the vscode uri
 * class, but has a filesystem associated with it.
 *
 * By associating the filesystem with the URI, we can allow for file URIs
 * to be scoped to a given filesystem (ie, a zip could be a filesystem )
 *
 * Uniform Resource Identifier (URI) https://tools.ietf.org/html/rfc3986.
 * This class is a simple parser which creates the basic component parts
 * (https://tools.ietf.org/html/rfc3986#section-3) with minimal validation
 * and encoding.
 *
 *
 * ```txt
 *       foo://example.com:8042/over/there?name=ferret#nose
 *       \_/   \______________/\_________/ \_________/ \__/
 *        |           |            |            |        |
 *     scheme     authority       path        query   fragment
 *        |   _____________________|__
 *       / \ /                        \
 *       urn:example:animal:ferret:nose
 * ```
 *
 */
class Uri {
    fileSystem;
    uri;
    constructor(fileSystem, uri) {
        this.fileSystem = fileSystem;
        this.uri = uri;
    }
    static invalid = new Uri(undefined, vscode_uri_1.URI.parse('invalid:'));
    static isInvalid(uri) {
        return uri === undefined || Uri.invalid === uri;
    }
    /**
    * scheme is the 'https' part of 'https://www.msft.com/some/path?query#fragment'.
    * The part before the first colon.
    */
    get scheme() { return this.uri.scheme; }
    /**
    * authority is the 'www.msft.com' part of 'https://www.msft.com/some/path?query#fragment'.
    * The part between the first double slashes and the next slash.
    */
    get authority() { return this.uri.authority; }
    /**
     * path is the '/some/path' part of 'https://www.msft.com/some/path?query#fragment'.
     */
    get path() { return this.uri.path; }
    /**
     * query is the 'query' part of 'https://www.msft.com/some/path?query#fragment'.
     */
    get query() { return this.uri.query; }
    /**
     * fragment is the 'fragment' part of 'https://www.msft.com/some/path?query#fragment'.
     */
    get fragment() { return this.uri.fragment; }
    /**
    * Creates a new Uri from a string, e.g. `https://www.msft.com/some/path`,
    * `file:///usr/home`, or `scheme:with/path`.
    *
    * @param value A string which represents an URI (see `URI#toString`).
    */
    static parse(fileSystem, value, _strict) {
        return new Uri(fileSystem, vscode_uri_1.URI.parse(value, _strict));
    }
    /**
     * Creates a new Uri from a string, and replaces 'vsix' schemes with file:// instead.
     *
     * @param value A string which represents a URI which may be a VSIX uri.
     */
    static parseFilterVsix(fileSystem, value, _strict, vsixBaseUri) {
        const parsed = vscode_uri_1.URI.parse(value, _strict);
        if (vsixBaseUri && parsed.scheme === 'vsix') {
            return vsixBaseUri.join(parsed.path);
        }
        return new Uri(fileSystem, parsed);
    }
    /**
   * Creates a new URI from a file system path, e.g. `c:\my\files`,
   * `/usr/home`, or `\\server\share\some\path`.
   *
   * The *difference* between `URI#parse` and `URI#file` is that the latter treats the argument
   * as path, not as stringified-uri. E.g. `URI.file(path)` is **not the same as**
   * `URI.parse('file://' + path)` because the path might contain characters that are
   * interpreted (# and ?). See the following sample:
   * ```ts
  const good = URI.file('/coding/c#/project1');
  good.scheme === 'file';
  good.path === '/coding/c#/project1';
  good.fragment === '';
  const bad = URI.parse('file://' + '/coding/c#/project1');
  bad.scheme === 'file';
  bad.path === '/coding/c'; // path is now broken
  bad.fragment === '/project1';
  ```
   *
   * @param path A file system path (see `URI#fsPath`)
   */
    static file(fileSystem, path) {
        return new Uri(fileSystem, vscode_uri_1.URI.file(path));
    }
    /** construct an Uri from the various parts */
    static from(fileSystem, components) {
        return new Uri(fileSystem, vscode_uri_1.URI.from(components));
    }
    /**
     * Join all arguments together and normalize the resulting Uri.
     *
     * Also ensures that slashes are all forward.
     * */
    join(...paths) {
        return new Uri(this.fileSystem, this.with({ path: (0, path_1.join)(this.path, ...paths).replace(/\\/g, '/') }));
    }
    relative(target) {
        assert_1.strict.ok(target.authority === this.authority, `Uris '${target.toString()}' and '${this.toString()}' are not of the same base`);
        return (0, path_1.relative)(this.path, target.path).replace(/\\/g, '/');
    }
    /** returns true if the uri represents a file:// resource. */
    get isLocal() {
        return this.scheme === 'file' || this.scheme === 'vsix';
    }
    get isHttps() {
        return this.scheme === 'https';
    }
    /**
     * Returns a string representing the corresponding file system path of this URI.
     * Will handle UNC paths, normalizes windows drive letters to lower-case, and uses the
     * platform specific path separator.
     *
     * * Will *not* validate the path for invalid characters and semantics.
     * * Will *not* look at the scheme of this URI.
     * * The result shall *not* be used for display purposes but for accessing a file on disk.
     *
     *
     * The *difference* to `URI#path` is the use of the platform specific separator and the handling
     * of UNC paths. See the below sample of a file-uri with an authority (UNC path).
     *
     * ```ts
        const u = URI.parse('file://server/c$/folder/file.txt')
        u.authority === 'server'
        u.path === '/shares/c$/file.txt'
        u.fsPath === '\\server\c$\folder\file.txt'
    ```
     *
     * Using `URI#path` to read a file (using fs-apis) would not be enough because parts of the path,
     * namely the server name, would be missing. Therefore `URI#fsPath` exists - it's sugar to ease working
     * with URIs that represent files on disk (`file` scheme).
     */
    get fsPath() {
        return this.uri.fsPath;
    }
    /** Duplicates the current Uri, changing out any parts */
    with(change) {
        return new Uri(this.fileSystem, this.uri.with(change));
    }
    /**
    * Creates a string representation for this URI. It's guaranteed that calling
    * `URI.parse` with the result of this function creates an URI which is equal
    * to this URI.
    *
    * * The result shall *not* be used for display purposes but for externalization or transport.
    * * The result will be encoded using the percentage encoding and encoding happens mostly
    * ignore the scheme-specific encoding rules.
    *
    * @param skipEncoding Do not encode the result, default is `false`
    */
    toString(skipEncoding) {
        return this.uri.toString(skipEncoding);
    }
    get formatted() {
        return this.scheme === 'file' ? this.uri.fsPath : this.uri.toString();
    }
    /** returns a JSON object with the components of the Uri */
    toJSON() {
        return this.uri.toJSON();
    }
    toUrl() {
        return new url_1.URL(this.uri.toString());
    }
    /* Act on this uri */
    resolve(uriOrRelativePath) {
        return typeof uriOrRelativePath === 'string' ? this.join(uriOrRelativePath) : uriOrRelativePath ?? this;
    }
    stat(uri) {
        uri = this.resolve(uri);
        return uri.fileSystem.stat(uri);
    }
    readDirectory(uri, options) {
        uri = this.resolve(uri);
        return uri.fileSystem.readDirectory(uri, options);
    }
    async createDirectory(uri) {
        uri = this.resolve(uri);
        await uri.fileSystem.createDirectory(uri);
        return uri;
    }
    readFile(uri) {
        uri = this.resolve(uri);
        return uri.fileSystem.readFile(uri);
    }
    async readUTF8(uri) {
        return (0, text_1.decode)(await this.readFile(uri));
    }
    async tryReadUTF8(uri) {
        try {
            return await this.readUTF8(uri);
            // eslint-disable-next-line no-empty
        }
        catch { }
        return undefined;
    }
    openFile(uri) {
        uri = this.resolve(uri);
        return uri.fileSystem.openFile(uri);
    }
    readStream(start = 0, end = Infinity) {
        return this.fileSystem.readStream(this, { start, end });
    }
    async readBlock(start = 0, end = Infinity) {
        const stream = await this.fileSystem.readStream(this, { start, end });
        let block = Buffer.alloc(0);
        for await (const chunk of stream) {
            block = Buffer.concat([block, chunk]);
        }
        return block;
    }
    async writeFile(content) {
        await this.fileSystem.writeFile(this, content);
        return this;
    }
    writeUTF8(content) {
        return this.writeFile((0, text_1.encode)(content));
    }
    writeStream(options) {
        return this.fileSystem.writeStream(this, options);
    }
    delete(options) {
        return this.fileSystem.delete(this, options);
    }
    exists(uri) {
        uri = this.resolve(uri);
        return uri.fileSystem.exists(uri);
    }
    isFile(uri) {
        uri = this.resolve(uri);
        return uri.fileSystem.isFile(uri);
    }
    isSymlink(uri) {
        uri = this.resolve(uri);
        return uri.fileSystem.isSymlink(uri);
    }
    isDirectory(uri) {
        uri = this.resolve(uri);
        return uri.fileSystem.isDirectory(uri);
    }
    async size(uri) {
        return (await this.stat(uri)).size;
    }
    async hash(algorithm) {
        if (algorithm) {
            return await (0, hash_1.hash)(await this.fileSystem.readStream(this), this, await this.size(), algorithm, {});
        }
        return undefined;
    }
    async hashValid(events, matchOptions) {
        if (matchOptions?.algorithm && await this.exists()) {
            events.hashVerifyStart?.(this.fsPath);
            const result = matchOptions.value?.toLowerCase() === await (0, hash_1.hash)(await this.readStream(), this, await this.size(), matchOptions.algorithm, events);
            events.hashVerifyComplete?.(this.fsPath);
            return result;
        }
        return false;
    }
    get parent() {
        return new Uri(this.fileSystem, this.with({
            path: (0, path_1.dirname)(this.path)
        }));
    }
}
exports.Uri = Uri;
function isFilePath(uriOrPath) {
    if (uriOrPath) {
        if (uriOrPath instanceof Uri) {
            return uriOrPath.scheme === 'file';
        }
        if (uriOrPath.startsWith('file:')) {
            return true;
        }
        return !!(/^[/\\.]|^[a-zA-Z]:/g.exec((uriOrPath || '').toString()));
    }
    return false;
}
exports.isFilePath = isFilePath;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXJpLmpzIiwic291cmNlUm9vdCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9taWNyb3NvZnQvdmNwa2ctdG9vbC9tYWluL3ZjcGtnLWFydGlmYWN0cy8iLCJzb3VyY2VzIjpbInV0aWwvdXJpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSx1Q0FBdUM7QUFDdkMsa0NBQWtDOzs7QUFFbEMsbUNBQWdDO0FBQ2hDLCtCQUErQztBQUUvQyw2QkFBMEI7QUFDMUIsMkNBQWlDO0FBSWpDLGlDQUErQztBQUMvQyxpQ0FBd0M7QUFFeEM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBdUJHO0FBQ0gsTUFBYSxHQUFHO0lBQ3dCO0lBQTJDO0lBQWpGLFlBQXNDLFVBQXNCLEVBQXFCLEdBQVE7UUFBbkQsZUFBVSxHQUFWLFVBQVUsQ0FBWTtRQUFxQixRQUFHLEdBQUgsR0FBRyxDQUFLO0lBRXpGLENBQUM7SUFFRCxNQUFNLENBQVUsT0FBTyxHQUFHLElBQUksR0FBRyxDQUFNLFNBQVMsRUFBRSxnQkFBRyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBRXpFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBUztRQUN4QixPQUFPLEdBQUcsS0FBSyxTQUFTLElBQUksR0FBRyxDQUFDLE9BQU8sS0FBSyxHQUFHLENBQUM7SUFDbEQsQ0FBQztJQUNEOzs7TUFHRTtJQUNGLElBQUksTUFBTSxLQUFLLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBRXhDOzs7TUFHRTtJQUNGLElBQUksU0FBUyxLQUFLLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBRTlDOztPQUVHO0lBQ0gsSUFBSSxJQUFJLEtBQUssT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFcEM7O09BRUc7SUFDSCxJQUFJLEtBQUssS0FBSyxPQUFPLElBQUksQ0FB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
// SIG // Begin signature block
// SIG // MIIoRAYJKoZIhvcNAQcCoIIoNTCCKDECAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // x/tRWbbZ9tHUekVFj4KgPaXxMHkY7+MkbqZRaduipNmg
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
// SIG // a/15n8G9bW1qyVJzEw16UM0xghomMIIaIgIBATCBlTB+
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNy
// SIG // b3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAE
// SIG // BGx0Bv9XKydyAAAAAAQEMA0GCWCGSAFlAwQCAQUAoIGu
// SIG // MBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisG
// SIG // AQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3
// SIG // DQEJBDEiBCD7kYY0rsC9EnhmfiUnUINrAzXe4Ienr/QQ
// SIG // wOMbZRyiizBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAEFesY4c
// SIG // qJb8+gvjPTyIdFPI1GkPs2w3kYhJlcVGHqSQmzwPYxFx
// SIG // 08reL208WPRfv823Qc2XBGJ1yR0JH/gLqIHnltjd+lMU
// SIG // mIodVg4Nif2S0iFd7ueAUf2zqqJEu2Mz4Ibjj+V+UWzw
// SIG // ekADt8b7NWnFnDxpZXXL2y/2E/Gng+YeZhJtkLd6ASEJ
// SIG // 2qu+CS8Kd84N/iH3KpoYfddgCd2ODbIJErn8VV+caN8Z
// SIG // cKfAPX3aO0Ws8OWhSB62EgYLBWGrhf8r+oND3VzeqJpB
// SIG // 7Eud1uvmqdUV41cTY9w3KgDLq52ec5rwufhFL84YtEFs
// SIG // BtaRX7Q6m9gFFPRnCwdC3I7SM2ChghewMIIXrAYKKwYB
// SIG // BAGCNwMDATGCF5wwgheYBgkqhkiG9w0BBwKggheJMIIX
// SIG // hQIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBWgYLKoZIhvcN
// SIG // AQkQAQSgggFJBIIBRTCCAUECAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQgAQrf3pJ2CRSWsVEuqYAo
// SIG // dml6KGQAXtV6TFiXDUAun4UCBmftMJw+CRgTMjAyNTA0
// SIG // MTYwMTA1MDUuMjg0WjAEgAIB9KCB2aSB1jCB0zELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYD
// SIG // VQQLEx5uU2hpZWxkIFRTUyBFU046NTkxQS0wNUUwLUQ5
// SIG // NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
// SIG // IFNlcnZpY2WgghH+MIIHKDCCBRCgAwIBAgITMwAAAfQX
// SIG // RoXAyz855QABAAAB9DANBgkqhkiG9w0BAQsFADB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNDA3MjUx
// SIG // ODMwNTlaFw0yNTEwMjIxODMwNTlaMIHTMQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMS0wKwYDVQQLEyRNaWNyb3NvZnQgSXJl
// SIG // bGFuZCBPcGVyYXRpb25zIExpbWl0ZWQxJzAlBgNVBAsT
// SIG // Hm5TaGllbGQgVFNTIEVTTjo1OTFBLTA1RTAtRDk0NzEl
// SIG // MCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
// SIG // dmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
// SIG // ggIBAKcIThOm0IAvaquIyRl9gNcqDm35NKnrUPJJI/uZ
// SIG // t+1gcQ5bGeaCZ438x7Kaj4jhFc2dstsoBoDWd/8XWUDe
// SIG // 3/QNVqdQHYeah12WYd0gV/AAbnOvU293CeSgmXFw7Ln8
// SIG // Jl3go/NRMyRCGarlXVfEk5ULngf29TCGLeUSorN7sM3Z
// SIG // X0pdHJB2xs6DvdWEyoOiBMaimKIxq3gqKZyCsTr5K+VW
// SIG // bI9n/eQW9SxhL7oQSJvwuycrLybwWVjba7Kc8l1Z7qPp
// SIG // AxMmcKZKYbEfGb3YvrP6UIqH5nW1tVKs1pal0FYKGF22
// SIG // mJBMmkof4XgbcI9bbnvi3LjnBwD4G8Gb0C5LCmiuOqJL
// SIG // a3oDkeHtInLBogFkfSC/p8uJpQlDQPOBexhBFjhL4m4o
// SIG // O8LK02umW87jLMk4tgM+Kj1d0EZBYMUm6eEeDhCp4p/C
// SIG // c+FyyNcF4QYSKTBnwNwU/OdJ6mps0og+S+acflbXwotD
// SIG // CU0tiwxdT2lWcJclWSFY1RyvKIdh2BvU9uhY0ffyPOYu
// SIG // RMcZoR6cTNmflISXmQOi8+Odpv/sawOMa3WGrOXJuxVI
// SIG // ctuKzy1R/hcvmcsBwKfXPaFk67Y3yCqiyL2LYCXONUPF
// SIG // sW2T0ewdbn7fARbL89nTki5MTwy3F1stegDcu979IqQs
// SIG // QMFBAvYbLItC3QfE4YjX/+APkWfLAgMBAAGjggFJMIIB
// SIG // RTAdBgNVHQ4EFgQUK3RloQrRLD4ndSyc7E2i0ykG35sw
// SIG // HwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIw
// SIG // XwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIw
// SIG // VGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwG
// SIG // CCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9N
// SIG // aWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAx
// SIG // MCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUBAf8E
// SIG // DDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJ
// SIG // KoZIhvcNAQELBQADggIBAN3B0g8SSlA7IGnCH0V+tLoD
// SIG // g0obAasLRFEVG1F3g5mGEmuaBY9+Ebo1t4Dngrfzmwzu
// SIG // Ob36Z2BuTkuWKMMLBcNfYIgiOiVfnHBv6qjNPJ8QEm88
// SIG // FraraK80IiYfbqbBOE1WXimF5m8se1jfbXW1SKwnpVY+
// SIG // z+onzB00i7egZsqEtsZQtnH4CjzwNd70t3rqlJes8Hux
// SIG // gIY34zV4ypROEjVib3aoK79BlESo6pmpjb4ZkiWp3uk2
// SIG // M6XQwnoKvGnZRh/OSNRFipnxEW9ZcysuTjDtnvSJAJb8
// SIG // naVLp9At7DRLadHoZYk9Eq2qvI3GFQx+ANgvzGywSMIp
// SIG // I8IhRkOEpRS09k4G+Br76XFlcwccA6PSEQcKc54G8s24
// SIG // YfeVFTq0C9q21h6xw0hN3YHS9srmh0YGOx2GC7OS7bN9
// SIG // MFPTrofDeeEVLWuhhWRceQOLiE4MiXFXVlWjdKo7NHhI
// SIG // 8BMjVL9HES7h1iQXo5DHt6kQIbwo54a6OwxkVmiJXcn8
// SIG // 2apZ+hbJy0N25fmb1SVk2Cbi/iGSyNkotyKyEX43HJ9v
// SIG // V9gV/789inGLmyIyul32L62UDeFym570qgTQMCD2NsSX
// SIG // geKPTwxBSNq3D2i1Ms+SFeyT9yUaYIN8bFKrxR5Uhurj
// SIG // CFo8B9BkCCMKwts0cvpTWbDip67sshzEEz+48uVPdqhB
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
// SIG // f9lwY1NNje6CbaUFEMFxBmoQtB1VM1izoXBm8qGCA1kw
// SIG // ggJBAgEBMIIBAaGB2aSB1jCB0zELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQg
// SIG // T3BlcmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5uU2hp
// SIG // ZWxkIFRTUyBFU046NTkxQS0wNUUwLUQ5NDcxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wi
// SIG // IwoBATAHBgUrDgMCGgMVAL/i2f1YNLNe13pOIhvUfXP+
// SIG // /gCOoIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwDQYJKoZIhvcNAQELBQACBQDrqXp8MCIYDzIw
// SIG // MjUwNDE2MDAzODIwWhgPMjAyNTA0MTcwMDM4MjBaMHcw
// SIG // PQYKKwYBBAGEWQoEATEvMC0wCgIFAOupenwCAQAwCgIB
// SIG // AAICCq0CAf8wBwIBAAICEzYwCgIFAOuqy/wCAQAwNgYK
// SIG // KwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgC
// SIG // AQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsF
// SIG // AAOCAQEACSSGSA23mlIpRvSSvIOVju/ndtKQ8jfz7E+7
// SIG // gorB6rI8PjS47nkg3eNR0dSfh6dI/82iujEc4JZSm0vt
// SIG // Px0s7gOaF1KtAn/PuoOEXOQ2jm1TqOvZgK+QunkK5TkQ
// SIG // Y9N3pGvOWPCwcovZHXSC128s8M07CuU1n6+li26opW/T
// SIG // wHAJmib+W5c6OsT7K1fPsA1CZYid4vC9m8j2dxIv2cDC
// SIG // K/IZjp3+2ikmHTIeCNNby2503MLVomlfjS6XttGUcREr
// SIG // 5TfD9z8sONob8R6DJyKCWeacDeJ+eL0bbY+9gFcchXOI
// SIG // zimlmzOmnyZjgVkIKMHmWHEjQm9Nk+JsedXESziXwzGC
// SIG // BA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwAhMzAAAB9BdGhcDLPznlAAEAAAH0MA0GCWCG
// SIG // SAFlAwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZI
// SIG // hvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEIKZAlcHV7TtX
// SIG // yWg+tXeU0IMsjQn/Pj9oRLGNvNjXBdFOMIH6BgsqhkiG
// SIG // 9w0BCRACLzGB6jCB5zCB5DCBvQQgP1jCfG4mk+p475JJ
// SIG // wfEO4UkCIvMrOryAb2YOtEQY1mswgZgwgYCkfjB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAfQXRoXA
// SIG // yz855QABAAAB9DAiBCBX9wIEq7rOoLS+4b0gGz2sCIZb
// SIG // SHxCyPuDc0OQL7JbUDANBgkqhkiG9w0BAQsFAASCAgB4
// SIG // aD++/l9lWOBPW9X77Qis3ylSuPGnLn0e40ZDKFfbGiMs
// SIG // mRBB4jewePLwwBmXjGKJp1gptKL5W8Ksv20ykSlv+Dtg
// SIG // 333gZ/V1FNevFCAZtLyudBg8SMNAA5XIlXIko1TsiKol
// SIG // IHisA4uMyHSfmHna7cfFGzB5jBibfgr5JIQKwMaQEndP
// SIG // TZHzaHosxONh+Iw0iD5JE4+YyPZFDHmXJmqC+3156DlL
// SIG // PzSKjXqbQy187XV2NcJN9pWhgTClyOWQecEbEMbR5qlS
// SIG // LvW/eE23hqa9Vu6pd7y98JZ1mUZIJykxOF697HoM4Ihk
// SIG // VDZV4GyEeCfdPUIWkYGw68hE9mZIPQXLTspmSnduqIGr
// SIG // 7a74vbQXdvrFcu3McUTBOHKaic7Fdwi0M3Xrqnyj8OP8
// SIG // LaZrdf5icoC3o3kuNgLk8CDnADutBFLmp4CjAsqIUeaF
// SIG // 9Xw8yl3BgBcmhNlDXv5IUlPU7Jebiy/XEkPeYCLjw5x2
// SIG // KrQso3Iy2g6/TCKCnuPJVq4wHmG1d+asWqlrzkxSN0j+
// SIG // 0srvSkuNlHRDJwU2AGakLnhbk9gTKwHx36K5G2myHjpW
// SIG // E2RRtM/xna9k83DCKX1P56oU6GQI3SFMsHLm9zvhHcTh
// SIG // +DEiAr2N8jFlbhXly8T6ydWf0ujIhlXT49mZvCCmQn20
// SIG // Q5RX0EfvSjKLmicy5MPx5g==
// SIG // End signature block
