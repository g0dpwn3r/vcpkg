"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystem = exports.ReadHandle = exports.FileType = void 0;
/* eslint-disable @typescript-eslint/ban-types */
const node_events_1 = require("node:events");
const stream_1 = require("stream");
const uri_1 = require("../util/uri");
const size64K = 1 << 16;
const size32K = 1 << 15;
/**
* Enumeration of file types. The types `File` and `Directory` can also be
* a symbolic links, in that case use `FileType.File | FileType.SymbolicLink` and
* `FileType.Directory | FileType.SymbolicLink`.
*/
var FileType;
(function (FileType) {
    /**
     * The file type is unknown.
     */
    FileType[FileType["Unknown"] = 0] = "Unknown";
    /**
     * A regular file.
     */
    FileType[FileType["File"] = 1] = "File";
    /**
     * A directory.
     */
    FileType[FileType["Directory"] = 2] = "Directory";
    /**
     * A symbolic link to a file.
     */
    FileType[FileType["SymbolicLink"] = 64] = "SymbolicLink";
})(FileType = exports.FileType || (exports.FileType = {}));
/**
 * A random-access reading interface to access a file in a FileSystem.
 *
 * Ideally, we keep reads in a file to a forward order, so that this can be implemented on filesystems
 * that do not support random access (ie, please do your best to order reads so that they go forward only as much as possible)
 *
 * Underneath on FSes that do not support random access, this would likely require multiple 'open' operation for the same
 * target file.
 */
class ReadHandle {
    async readComplete(buffr, offset = 0, length = buffr.byteLength, position = null, totalRead = 0) {
        const { bytesRead, buffer } = await this.read(buffr, offset, length, position);
        if (length) {
            if (bytesRead && bytesRead < length) {
                return await this.readComplete(buffr, offset + bytesRead, length - bytesRead, position ? position + bytesRead : null, bytesRead + totalRead);
            }
        }
        return { bytesRead: bytesRead + totalRead, buffer };
    }
    /**
     * Returns a Readable for consuming an opened ReadHandle
     * @param start the first byte to read of the target
     * @param end the last byte to read of the target (inclusive!)
     */
    readStream(start = 0, end = Infinity) {
        return stream_1.Readable.from(asyncIterableOverHandle(start, end, this), {});
    }
    range(start, length) {
        return new RangeReadHandle(this, start, length);
    }
}
exports.ReadHandle = ReadHandle;
class RangeReadHandle extends ReadHandle {
    start;
    length;
    pos = 0;
    readHandle;
    constructor(readHandle, start, length) {
        super();
        this.start = start;
        this.length = length;
        this.readHandle = readHandle;
    }
    async read(buffer, offset, length, position) {
        if (this.readHandle) {
            position = position !== undefined && position !== null ? (position + this.start) : (this.pos + this.start);
            length = length === null ? this.length : length;
            const result = await this.readHandle.read(buffer, offset, length, position);
            this.pos += result.bytesRead;
            return result;
        }
        return {
            bytesRead: 0, buffer
        };
    }
    async size() {
        return this.length;
    }
    async close() {
        this.readHandle = undefined;
    }
}
/**
 * Picks a reasonable buffer size. Not more than 64k
 *
 * @param length
 */
function reasonableBuffer(length) {
    return Buffer.alloc(length > size64K ? size32K : length);
}
/**
 * Creates an AsyncIterable<Buffer> over a ReadHandle
 * @param start the first byte in the target read from
 * @param end the last byte in the target to read from
 * @param handle the ReadHandle
 */
async function* asyncIterableOverHandle(start, end, handle) {
    while (start < end) {
        // buffer alloc must be inside the loop; zlib will hold the buffers until it can deal with a whole stream.
        const buffer = reasonableBuffer(1 + end - start);
        const count = Math.min(1 + end - start, buffer.byteLength);
        const b = await handle.read(buffer, 0, count, start);
        if (b.bytesRead === 0) {
            return;
        }
        start += b.bytesRead;
        // return only what was actually read. (just a view)
        if (b.bytesRead === buffer.byteLength) {
            yield buffer;
        }
        else {
            yield buffer.slice(0, b.bytesRead);
        }
    }
}
class FileSystem extends node_events_1.EventEmitter {
    session;
    baseUri;
    /**
   * Creates a new URI from a file system path, e.g. `c:\my\files`,
   * `/usr/home`, or `\\server\share\some\path`.
   *
   * associates this FileSystem with the Uri
   *
   * @param path A file system path (see `URI#fsPath`)
   */
    file(path) {
        return uri_1.Uri.file(this, path);
    }
    /** construct an Uri from the various parts */
    from(components) {
        return uri_1.Uri.from(this, components);
    }
    /**
   * Creates a new URI from a string, e.g. `https://www.msft.com/some/path`,
   * `file:///usr/home`, or `scheme:with/path`.
   *
   * @param value A string which represents an URI (see `URI#toString`).
   */
    parseUri(value, _strict) {
        return uri_1.Uri.parse(this, value, _strict);
    }
    /** checks to see if the target exists */
    async exists(uri) {
        try {
            return !!(await this.stat(uri));
        }
        catch (e) {
            // if this fails, we're assuming false
        }
        return false;
    }
    /** checks to see if the target is a directory/folder */
    async isDirectory(uri) {
        try {
            return !!((await this.stat(uri)).type & FileType.Directory);
        }
        catch {
            // if this fails, we're assuming false
        }
        return false;
    }
    /** checks to see if the target is a file */
    async isFile(uri) {
        try {
            const s = await this.stat(uri);
            return !!(s.type & FileType.File);
        }
        catch {
            // if this fails, we're assuming false
        }
        return false;
    }
    /** checks to see if the target is a symbolic link */
    async isSymlink(uri) {
        try {
            return !!((await this.stat(uri)) && FileType.SymbolicLink);
        }
        catch {
            // if this fails, we're assuming false
        }
        return false;
    }
    constructor(session) {
        super();
        this.session = session;
    }
    /** EventEmitter for when files are read */
    read(path, context) {
        this.emit('read', path, context, this.session.stopwatch.total);
    }
    /** EventEmitter for when files are written */
    write(path, context) {
        this.emit('write', path, context, this.session.stopwatch.total);
    }
    /** EventEmitter for when files are deleted */
    deleted(path, context) {
        this.emit('deleted', path, context, this.session.stopwatch.total);
    }
    /** EventEmitter for when files are renamed */
    renamed(path, context) {
        this.emit('renamed', path, context, this.session.stopwatch.total);
    }
    /** EventEmitter for when directories are read */
    directoryRead(path, contents) {
        this.emit('directoryRead', path, contents, this.session.stopwatch.total);
    }
    /** EventEmitter for when direcotries are created */
    directoryCreated(path, context) {
        this.emit('directoryCreated', path, context, this.session.stopwatch.total);
    }
}
exports.FileSystem = FileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZXN5c3RlbS5qcyIsInNvdXJjZVJvb3QiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vbWljcm9zb2Z0L3ZjcGtnLXRvb2wvbWFpbi92Y3BrZy1hcnRpZmFjdHMvIiwic291cmNlcyI6WyJmcy9maWxlc3lzdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSx1Q0FBdUM7QUFDdkMsa0NBQWtDOzs7QUFFbEMsaURBQWlEO0FBRWpELDZDQUEyQztBQUMzQyxtQ0FBNEM7QUFFNUMscUNBQWtDO0FBRWxDLE1BQU0sT0FBTyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDeEIsTUFBTSxPQUFPLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQXVDeEI7Ozs7RUFJRTtBQUNGLElBQVksUUFpQlg7QUFqQkQsV0FBWSxRQUFRO0lBQ2xCOztPQUVHO0lBQ0gsNkNBQVcsQ0FBQTtJQUNYOztPQUVHO0lBQ0gsdUNBQVEsQ0FBQTtJQUNSOztPQUVHO0lBQ0gsaURBQWEsQ0FBQTtJQUNiOztPQUVHO0lBQ0gsd0RBQWlCLENBQUE7QUFDbkIsQ0FBQyxFQWpCVyxRQUFRLEdBQVIsZ0JBQVEsS0FBUixnQkFBUSxRQWlCbkI7QUFRRDs7Ozs7Ozs7R0FRRztBQUNILE1BQXNCLFVBQVU7SUFXOUIsS0FBSyxDQUFDLFlBQVksQ0FBNkIsS0FBYyxFQUFFLE1BQU0sR0FBRyxDQUFDLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxVQUFVLEVBQUUsV0FBMEIsSUFBSSxFQUFFLFNBQVMsR0FBRyxDQUFDO1FBQ2pKLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQy9FLElBQUksTUFBTSxFQUFFO1lBQ1YsSUFBSSxTQUFTLElBQUksU0FBUyxHQUFHLE1BQU0sRUFBRTtnQkFDbkMsT0FBTyxNQUFNLElBQUksQ0FB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
// SIG // Begin signature block
// SIG // MIIoQQYJKoZIhvcNAQcCoIIoMjCCKC4CAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // nLkG9ta88s7AMrRh67jTSV5nCt9M+PUfGPBYuaVkQOmg
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
// SIG // DQEJBDEiBCAH/Il6185HQp3xu/1GtVe4W1brTrdzv99K
// SIG // mj0acxEDRDBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAHaP+DY+
// SIG // 8wp3G1+ky/b4mMRvPCFyphEELQrgfah98QxiS/F+X4Ny
// SIG // 7jnVlhGH1lzZjZBfThOPzkJYfWJCHY1Z/UmVK5eyjd4W
// SIG // W4zwtesd5ifq4+ekKC8verdte7hI9Fhhr/CGSCkazVFR
// SIG // HClesi7Dsv6U0Vd9YTGsuTNpTQxEXHBb6Yr3CgnV8v9k
// SIG // mvZ4QcRvDqoSfF4SP/nocgvu0iE8ycloqS1ipAUksjZ5
// SIG // ayOGHG6rPUf+GJ3ze+8nd3buD+Qi/QsOq6f7LU/wljgk
// SIG // f+2Dl86lHV2OzpJiniQ3Vsf4IGr3Uli6e1tedjf00fqO
// SIG // N9TenVXCX5XrLOcgPbQ9dOB0X5mhghetMIIXqQYKKwYB
// SIG // BAGCNwMDATGCF5kwgheVBgkqhkiG9w0BBwKggheGMIIX
// SIG // ggIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBWgYLKoZIhvcN
// SIG // AQkQAQSgggFJBIIBRTCCAUECAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQgyOyR/igYGJ3/Iqe8ZJfN
// SIG // KI+DaimF5cbT0V41VqPsy2oCBmf1QDdTERgTMjAyNTA0
// SIG // MTYwMTA1MTQuNDExWjAEgAIB9KCB2aSB1jCB0zELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYD
// SIG // VQQLEx5uU2hpZWxkIFRTUyBFU046NkIwNS0wNUUwLUQ5
// SIG // NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
// SIG // IFNlcnZpY2WgghH7MIIHKDCCBRCgAwIBAgITMwAAAfaD
// SIG // LyZqVF0iwQABAAAB9jANBgkqhkiG9w0BAQsFADB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNDA3MjUx
// SIG // ODMxMDRaFw0yNTEwMjIxODMxMDRaMIHTMQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMS0wKwYDVQQLEyRNaWNyb3NvZnQgSXJl
// SIG // bGFuZCBPcGVyYXRpb25zIExpbWl0ZWQxJzAlBgNVBAsT
// SIG // Hm5TaGllbGQgVFNTIEVTTjo2QjA1LTA1RTAtRDk0NzEl
// SIG // MCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
// SIG // dmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
// SIG // ggIBANFCXizEfzfVjwWYbilRRfnliWevFro3Y+F+iUdO
// SIG // XMTuQnqTV6Ne61Ws8Fi5JuQI2lYdfWVYwwoR84psbKGl
// SIG // 8TbvCA4ICsKV76QACLb+FMedHvUtrlcHyr+e6fSShvkO
// SIG // 1TjUobo5dTQjJHIEqz3Znf/M3LJoc3DaGy6JqwgCDkWf
// SIG // CMIWMuLIlUJX9TSoZcgM5pFiQ9DfutCIqIBQc4N8iErL
// SIG // 66DsdMdcUotj4kSEJU1xO+DIIGQyAyqh/4W/RU9pCv51
// SIG // f2l47qPSzK60Zp+OKGGAA3v6zveRfkht7rroX/h+CK4l
// SIG // 69IfabQOksByT0tlZmzVgo0FquRuGJK3KmzzGse7zV1M
// SIG // Lu0+uRPHxT3dSLhPUbBuEzAFe15FwaKZjzX7y9IY8YOO
// SIG // JKUJ9/OFeOqPs3UKsuSvXQ5Vpvyer2baecgNT8g98Ph2
// SIG // xrm0tJ4hENS+sBjqz38yJtBXTp/sRaOPBEZfhccP9zr1
// SIG // zOQmNRKp8xM5z48yXOzicISVUd1UAx4wXBBUzr0vRNHY
// SIG // jbtXqHMPmQpM+D7v6EL/oKlPm38S/HuzxZLX0Q5TOhcj
// SIG // s4z+M7iNuYA/LTvcyYOoOn0aWmXON/ZgG5Jd8wlc0yw4
// SIG // HIb+ksUGoybb76EGmcUH9LUYj3G69h1nzKKqnfbokNIU
// SIG // 1BIRuOBQUk3lD2XhHp0QlmnQluBvAgMBAAGjggFJMIIB
// SIG // RTAdBgNVHQ4EFgQUSMGbCbjnCX0nD1nF2bgQOAfPSvIw
// SIG // HwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIw
// SIG // XwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIw
// SIG // VGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwG
// SIG // CCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9N
// SIG // aWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAx
// SIG // MCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUBAf8E
// SIG // DDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJ
// SIG // KoZIhvcNAQELBQADggIBANd5AYqx9XB7tVmEdcrI9dua
// SIG // JhrUND2kJBM8Bm+9MbakqCPrL0IobIHU2MWj36diFRXY
// SIG // I2jGgYvNcAfP57vOuhXxSinYXad8JzGfdT6T+DqHuzXH
// SIG // +qiApIErsIHSHUL6hNIfFUOUFubA1eENCZ4+H+yh2MeD
// SIG // YjPAuI08PEkLbLsVokx9h4pH90GAe9Wu3Qfc4BzpFtIY
// SIG // FBHljvZodsFqmEv0OPAEozqmMP4WueKFTn39tlmqB/vx
// SIG // 8XfTUxFP+L5b7ESDFk9I7JzSO9Y1QK0+EPQbelUoVs8q
// SIG // q2hOkilKGaxMAaVbCNCzINl94Ti25Qtb8TN/sDMjofe2
// SIG // hTrO7BZ7nprSNjH4/KoNegWUycV5aT7q1qxvjgY+AaEw
// SIG // 5AvQMV2Ad8hLbsDLO6UVi8sSMcP8FfUxylBpvsflRNDz
// SIG // i8JK0jII7pUl5KXxCx1loglbJSWxSCAf+AJb/o0CUigC
// SIG // bqPQhK25tqng5P84yWJWGlRjMirmGfrkkVSgdqpBD3BM
// SIG // xtXTvcyGtTKd9ifs81tz+7LiX48OtrN4Qzi5PupTEDkd
// SIG // OMftqNexty3Hi5JMSZuNRK3Yk4wJnQpXp/cpeh4DKRku
// SIG // KJIxQiV/gqThV+4AQNz1cUFrm4rAEGy+R4ExQbUDRM3A
// SIG // nYdRmMP+p88zTbftBkJ56GwXXXzgIqpM7yLal47xsitU
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
// SIG // ZWxkIFRTUyBFU046NkIwNS0wNUUwLUQ5NDcxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wi
// SIG // IwoBATAHBgUrDgMCGgMVABVPXkqXcbNGtOiRSLhhRyI/
// SIG // yPt+oIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwDQYJKoZIhvcNAQELBQACBQDrqPjCMCIYDzIw
// SIG // MjUwNDE1MTUyNDUwWhgPMjAyNTA0MTYxNTI0NTBaMHQw
// SIG // OgYKKwYBBAGEWQoEATEsMCowCgIFAOuo+MICAQAwBwIB
// SIG // AAICJVAwBwIBAAICEyEwCgIFAOuqSkICAQAwNgYKKwYB
// SIG // BAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgCAQAC
// SIG // AwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOC
// SIG // AQEAFQ3yripamuYjFDdVFwLzU1lrV+HfW0Z2J8z6P1sx
// SIG // tk4Y85PMZGFSZu91XYU+oRGCyhrlxeCn/Sa/+xJH440U
// SIG // F4dsURB2Ajl+kSTMqpnhdhniVjrtG4FzEgOuLE3Vqt/8
// SIG // jBIt/0nTo67pHs1nangb99CAGOro6eVlqCRKFSzuLiBI
// SIG // atXmm4Z66s6HPU22H/VpuVqgM1UaYbUyoxD4+5sNJXKy
// SIG // apwRUvlSYRiMOG41w9vttC+cmsjuAHc4qwCv+P83dPTd
// SIG // yeNHV9+p5s6lu5RJFOlUsZlngUwC/E7yS0bg/l/VUH83
// SIG // Xm6UDoHTfJbFKiLENCJGNjoBmlQ/3cn3azpIxDGCBA0w
// SIG // ggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAk
// SIG // BgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
// SIG // MDEwAhMzAAAB9oMvJmpUXSLBAAEAAAH2MA0GCWCGSAFl
// SIG // AwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcN
// SIG // AQkQAQQwLwYJKoZIhvcNAQkEMSIEIFeeZ9bkGLXQQcmT
// SIG // htAeMwxQA/LO/3bkOCgSqLPA2TiqMIH6BgsqhkiG9w0B
// SIG // CRACLzGB6jCB5zCB5DCBvQQgK2FM8ZRepuVEi0uH/DVy
// SIG // //GqDRFXbAmUZhfi5UIxtqIwgZgwgYCkfjB8MQswCQYD
// SIG // VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
// SIG // A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
// SIG // IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAfaDLyZqVF0i
// SIG // wQABAAAB9jAiBCC6W/JWxufcDgSMUk2KpBo/Ev6Y+fxb
// SIG // oAYacDdjdTAICDANBgkqhkiG9w0BAQsFAASCAgAmQljq
// SIG // A/FBuiG8ZzPdHynM5YpPQFoppCcEF6tkOaxuuSJyP7Ko
// SIG // N9Z4gEC30xs4OKcGXqFD+1tVHLndghfNnN6ve+XE1xWR
// SIG // 58vU4kfXAF6hyGp0gJ6Z6npOvkthv84GJeDW/68E1cNl
// SIG // ZgsfMBPn+VaUAZSu/X1HhVRjxEux2OJ0Z96USxJhVj5G
// SIG // aukiPEOCn1GBaxna2VKPtDdekKaiR39FffZ+RaH0mNqr
// SIG // xFLC8AzKILv89cUhrUiTC74IUMsRyWsFE0WVZPdBLutX
// SIG // rulPC78B8ijzpi6NCz+cOKDsTTWiV1mRvPPQa85yH8JK
// SIG // 1lKUJ4WPWKjI1uoDWs+TmcUxW2US0qHwyHWRtg9WVyJE
// SIG // ZK6DGLXJSu0zyizFfPWF1a53yTs6MUVs/N/Hkex4N2CF
// SIG // onDH/7wk5tMjA5LuVnnPhFlM85gdn7h8sLSviTgeAxag
// SIG // 11PfPBtO6jw6lnxXtXFKKmMSPk6w7ZCkAKkxVbtNngro
// SIG // H1sg0cZKPSzEBc6RsS/h7+OrI5+93Fiy5j0HsgzLlMI4
// SIG // lpYFzmp3G0UEhI09gtdwAdpxcSH+xn9BIOZIrof8RNZu
// SIG // 4V26Tdq4qt13JVq39NKtEfuxtrW/9G+lGZw1ZZ+Dcwpp
// SIG // BBRfWjuwR+GTO32zMUmBY9XqafbPfoDK9B1J5FYcz52a
// SIG // W4fKV870tK3Zb9QJ4g==
// SIG // End signature block
