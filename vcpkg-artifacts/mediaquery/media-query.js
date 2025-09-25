"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.takeWhitespace = exports.parseQuery = void 0;
const i18n_1 = require("../i18n");
const scanner_1 = require("./scanner");
function parseQuery(text) {
    const cursor = new scanner_1.Scanner(text);
    return QueryList.parse(cursor);
}
exports.parseQuery = parseQuery;
function takeWhitespace(cursor) {
    while (!cursor.eof && isWhiteSpace(cursor)) {
        cursor.take();
    }
}
exports.takeWhitespace = takeWhitespace;
function isWhiteSpace(cursor) {
    return cursor.kind === scanner_1.Kind.Whitespace;
}
class QueryList {
    queries = new Array();
    get isValid() {
        return !this.error;
    }
    error;
    constructor() {
        //
    }
    get length() {
        return this.queries.length;
    }
    static parse(cursor) {
        const result = new QueryList();
        try {
            cursor.scan(); // start the scanner
            for (const statement of QueryList.parseQuery(cursor)) {
                result.queries.push(statement);
            }
        }
        catch (error) {
            result.error = error;
        }
        return result;
    }
    static *parseQuery(cursor) {
        takeWhitespace(cursor);
        if (cursor.eof) {
            return;
        }
        yield Query.parse(cursor);
        takeWhitespace(cursor);
        if (cursor.eof) {
            return;
        }
        switch (cursor.kind) {
            case scanner_1.Kind.Comma:
                cursor.take();
                return yield* QueryList.parseQuery(cursor);
            case scanner_1.Kind.EndOfFile:
                return;
        }
        throw new scanner_1.MediaQueryError((0, i18n_1.i) `Expected comma, found ${JSON.stringify(cursor.text)}`, cursor.position.line, cursor.position.column);
    }
    get features() {
        const result = new Set();
        for (const query of this.queries) {
            for (const expression of query.expressions) {
                if (expression.feature) {
                    result.add(expression.feature);
                }
            }
        }
        return result;
    }
    match(properties) {
        if (this.isValid) {
            queries: for (const query of this.queries) {
                for (const { feature, constant, not } of query.expressions) {
                    // get the value from the context
                    const contextValue = stringValue(properties[feature]);
                    if (not) {
                        // negative/not present query
                        if (contextValue) {
                            // we have a value
                            if (constant && contextValue !== constant) {
                                continue; // the values are NOT a match.
                            }
                            if (!constant && contextValue === 'false') {
                                continue;
                            }
                        }
                        else {
                            // no value
                            if (!constant || contextValue === 'false') {
                                continue;
                            }
                        }
                    }
                    else {
                        // positive/present query
                        if (contextValue) {
                            if (contextValue === constant || contextValue !== 'false' && !constant) {
                                continue;
                            }
                        }
                        else {
                            if (constant === 'false') {
                                continue;
                            }
                        }
                    }
                    continue queries; // no match
                }
                // we matched a whole query, we're good
                return true;
            }
        }
        // no query matched.
        return false;
    }
}
function stringValue(value) {
    switch (typeof value) {
        case 'string':
        case 'number':
        case 'boolean':
            return value.toString();
        case 'object':
            return value === null ? 'true' : Array.isArray(value) ? stringValue(value[0]) || 'true' : 'true';
    }
    return undefined;
}
class Query {
    expressions;
    constructor(expressions) {
        this.expressions = expressions;
    }
    static parse(cursor) {
        const result = new Array();
        takeWhitespace(cursor);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            result.push(Expression.parse(cursor));
            takeWhitespace(cursor);
            if (cursor.kind === scanner_1.Kind.AndKeyword) {
                cursor.take(); // consume and
                continue;
            }
            // the next token is not an 'and', so we bail now.
            return new Query(result);
        }
    }
}
class Expression {
    featureToken;
    constantToken;
    not;
    constructor(featureToken, constantToken, not) {
        this.featureToken = featureToken;
        this.constantToken = constantToken;
        this.not = not;
    }
    get feature() {
        return this.featureToken.text;
    }
    get constant() {
        return this.constantToken?.stringValue || this.constantToken?.text || undefined;
    }
    /** @internal */
    static parse(cursor, isNotted = false, inParen = false) {
        takeWhitespace(cursor);
        switch (cursor.kind) {
            case scanner_1.Kind.Identifier: {
                // start of an expression
                const feature = cursor.take();
                takeWhitespace(cursor);
                if (cursor.kind === scanner_1.Kind.Colon) {
                    cursor.take(); // consume colon;
                    // we have a constant for the
                    takeWhitespace(cursor);
                    switch (cursor.kind) {
                        case scanner_1.Kind.NumericLiteral:
                        case scanner_1.Kind.BooleanLiteral:
                        case scanner_1.Kind.Identifier:
                        case scanner_1.Kind.StringLiteral: {
                            // we have a good const value.
                            const constant = cursor.take();
                            return new Expression(feature, constant, isNotted);
                        }
                    }
                    throw new scanner_1.MediaQueryError((0, i18n_1.i) `Expected one of {Number, Boolean, Identifier, String}, found token ${JSON.stringify(cursor.text)}`, cursor.position.line, cursor.position.column);
                }
                return new Expression(feature, undefined, isNotted);
            }
            case scanner_1.Kind.NotKeyword:
                if (isNotted) {
                    throw new scanner_1.MediaQueryError((0, i18n_1.i) `Expression specified NOT twice`, cursor.position.line, cursor.position.column);
                }
                cursor.take(); // suck up the not token
                return Expression.parse(cursor, true, inParen);
            case scanner_1.Kind.OpenParen: {
                cursor.take();
                const result = Expression.parse(cursor, isNotted, inParen);
                takeWhitespace(cursor);
                if (cursor.kind !== scanner_1.Kind.CloseParen) {
                    throw new scanner_1.MediaQueryError((0, i18n_1.i) `Expected close parenthesis for expression, found ${JSON.stringify(cursor.text)}`, cursor.position.line, cursor.position.column);
                }
                cursor.take();
                return result;
            }
            default:
                throw new scanner_1.MediaQueryError((0, i18n_1.i) `Expected expression, found ${JSON.stringify(cursor.text)}`, cursor.position.line, cursor.position.column);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkaWEtcXVlcnkuanMiLCJzb3VyY2VSb290IjoiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL21pY3Jvc29mdC92Y3BrZy10b29sL21haW4vdmNwa2ctYXJ0aWZhY3RzLyIsInNvdXJjZXMiOlsibWVkaWFxdWVyeS9tZWRpYS1xdWVyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsdUNBQXVDO0FBQ3ZDLGtDQUFrQzs7O0FBRWxDLGtDQUE0QjtBQUM1Qix1Q0FBa0U7QUFFbEUsU0FBZ0IsVUFBVSxDQUFDLElBQVk7SUFDckMsTUFBTSxNQUFNLEdBQUcsSUFBSSxpQkFBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRWpDLE9BQU8sU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBSkQsZ0NBSUM7QUFFRCxTQUFnQixjQUFjLENBQUMsTUFBZTtJQUM1QyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDMUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO0tBQ2Y7QUFDSCxDQUFDO0FBSkQsd0NBSUM7QUFFRCxTQUFTLFlBQVksQ0FBQyxNQUFlO0lBQ25DLE9BQU8sTUFBTSxDQUFDLElBQUksS0FBSyxjQUFJLENBQUMsVUFBVSxDQUFDO0FBQ3pDLENBQUM7QUFFRCxNQUFNLFNBQVM7SUFDYixPQUFPLEdBQUcsSUFBSSxLQUFLLEVBQVMsQ0FBQztJQUM3QixJQUFJLE9BQU87UUFDVCxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNyQixDQUFDO0lBQ0QsS0FBSyxDQUFtQjtJQUV4QjtRQUNFLEVBQUU7SUFDSixDQUFDO0lBRUQsSUFBSSxNQUFNO1FBQ1IsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUM3QixDQUFDO0lBQ0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFlO1FBQzFCLE1BQU0sTUFBTSxHQUFHLElBQUks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
// SIG // Begin signature block
// SIG // MIIoRAYJKoZIhvcNAQcCoIIoNTCCKDECAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // 7RIMqzBtVDBEEi9YmLtEo56ksmObt6DU0kuRGINTtyGg
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
// SIG // DQEJBDEiBCDmh8BJmRSWuXmzyvLv+UzVmm8FqDEZX4VN
// SIG // /rL8EAFfczBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAGEvJx0a
// SIG // rd/tLmC9blcnSO6+GtzwkoS8j8PMtGR1UjCXZpdHydKO
// SIG // aD6d/IoqKt0r/iKGp0cjmRLeWAbE3sr6Bf8MPlPjdKkG
// SIG // J0wGnk1Y0c2Qndwc+OUdZOzAR5k9JvjyUFq+eOx8T10N
// SIG // VO5v8m5CRN2kcJO+1OyVaxfh7v225Qvxk8BvIOm8xbU4
// SIG // JRzqztt8XLRF6kYiAz7GwkoCrw5ML9EgqbX4RfwGxZmj
// SIG // FRitPH4ZJVlkB7hbQdOBLdkUzbGGJk+qgTetkNrx56J8
// SIG // Q/MSvO1WJ3X7SLfQVuglwQDZy3rmHOWO4uxX3qZKCnlG
// SIG // f/LEMdZZAmv7dWpy9Ns2FaQyjwahghewMIIXrAYKKwYB
// SIG // BAGCNwMDATGCF5wwgheYBgkqhkiG9w0BBwKggheJMIIX
// SIG // hQIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBWgYLKoZIhvcN
// SIG // AQkQAQSgggFJBIIBRTCCAUECAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQgIGZ+6oC/7PyU/vVXTxvT
// SIG // gBMDs44X/ksG06FAevkAjHECBmftNv7l6hgTMjAyNTA0
// SIG // MTYwMTA1MTAuMjk1WjAEgAIB9KCB2aSB1jCB0zELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYD
// SIG // VQQLEx5uU2hpZWxkIFRTUyBFU046NDAxQS0wNUUwLUQ5
// SIG // NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
// SIG // IFNlcnZpY2WgghH+MIIHKDCCBRCgAwIBAgITMwAAAf7Q
// SIG // qMJ7NCELAQABAAAB/jANBgkqhkiG9w0BAQsFADB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNDA3MjUx
// SIG // ODMxMThaFw0yNTEwMjIxODMxMThaMIHTMQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMS0wKwYDVQQLEyRNaWNyb3NvZnQgSXJl
// SIG // bGFuZCBPcGVyYXRpb25zIExpbWl0ZWQxJzAlBgNVBAsT
// SIG // Hm5TaGllbGQgVFNTIEVTTjo0MDFBLTA1RTAtRDk0NzEl
// SIG // MCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
// SIG // dmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
// SIG // ggIBALy8IRcVpagON6JbBODwnoGeJkn7B9mE0ihGL/Bp
// SIG // 99+tgZmsnHX+U97UMaT9zVputmB1IniEF8PtLuKpWsuA
// SIG // DdyKJyPuOzaYvX6OdsXQFzF9KRq3NHqlvEVjd2381zyr
// SIG // 9OztfIth4w8i7ssGMigPRZlm3j42oX/TMHfEIMoJD7cA
// SIG // 61UBi8jpMjN1U4hyqoRrvQQhlUXR1vZZjzK61JT1omFf
// SIG // S1QgeVWHfgBFLXX6gHapc1cQOdxIMUqoaeiW3xCp03XH
// SIG // z+k/DIq9B68E07VdodsgwbY120CGqsnCjm+t9xn0ZJ9t
// SIG // eizgwYN+z/8cIaHV0/NWQtmhze3sRA5pm4lrLIxrxSZJ
// SIG // YtoOnbdNXkoTohpoW6J69Kl13AXqjW+kKBfI1/7g1bWP
// SIG // aby+I/GhFkuPYSlB9Js7ArnCK8FEvsfDLk9Ln+1VwhTR
// SIG // W4glDUU6H8SdweOeHhiYS9H8FE0W4Mgm6S4CjCg4gkbm
// SIG // +uQ4Wng71AACU/dykgqHhQqJJT2r24EMmoRmQy/71gFY
// SIG // 1+W/Cc4ZcvYBgnSv6ouovnMWdEvMegdsoz22X3QVXx/z
// SIG // Qaf9S5+8W3jhEwDp+zk/Q91BrdKvioloGONh5y48oZdW
// SIG // wLuR34K8gDtwwmiHVdrY75CWstqjpxew4I/GutCkE/UI
// SIG // HyX8F5692Som2DI2lGwjSA58c9spAgMBAAGjggFJMIIB
// SIG // RTAdBgNVHQ4EFgQUb857ifUlNoOZf+f2/uQgYm2xxd0w
// SIG // HwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIw
// SIG // XwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIw
// SIG // VGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwG
// SIG // CCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9N
// SIG // aWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAx
// SIG // MCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUBAf8E
// SIG // DDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJ
// SIG // KoZIhvcNAQELBQADggIBAIk+DVLztpcPtHQzLbAbsZl9
// SIG // qN5VUKp0JLiEwBiBgoCPrJe2amTkw3fC6sbB+Blgj087
// SIG // XN7a/AIAb7GCM1oxcIqAowkDg6taATFjcxLCs3JB8QM2
// SIG // KOUs3uzj5DANwwMVauEkkfMvk0QthnDndCUXmdZT5YZT
// SIG // 5fVyPs/DoLTj5kJyy4j/as6Ux8Bc3vrG6kp/HHpHbjGX
// SIG // S8hyZNzYsNwJ4JVP1k8xrEAHXIfUlVeCx4n1J5sE39It
// SIG // O4irU5TZKt28dYsloOze4xmQAUVk9pl/mAFR5Stu7fZ/
// SIG // lrWG5+nDiTV+i7B/MT1QUWACEVZFrDMhAHaD/Xan2mc8
// SIG // Fxpo7lUPd9TYcx44xvhH8NdfA145N1at6lCNa3t+MzDE
// SIG // 0c2WRMPNhbqRd74lzUdw1TpUvSR+MeXpnyDWtbrkmnOh
// SIG // eAniQg9RmpH0uw+WsjbGmdnvrAVIetilU5YRLEER2UcA
// SIG // k8W4sdWOIicPjwzS3NB39fal9l4l9LtkjPQlk047M/Ur
// SIG // woyCksQmRQjb/86SiJbB8e4UDUB0jGyodP8MJ/OroiAC
// SIG // xI2s1LMxNPl+q3Dmw31OIfzv9L5mxdwTEfuOawGTABEy
// SIG // bEQz8RyQqP+VxoVnYPy6CeV1gazgy+OGDazexUZxxAAK
// SIG // 9OrH5amfHnldxbgynT+YdfVlJxlsDtR/2Y1MzqFRold4
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
// SIG // ZWxkIFRTUyBFU046NDAxQS0wNUUwLUQ5NDcxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wi
// SIG // IwoBATAHBgUrDgMCGgMVAIRjRw/2u0NG0C1lRvSbhsYC
// SIG // 0V7HoIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwDQYJKoZIhvcNAQELBQACBQDrqNgfMCIYDzIw
// SIG // MjUwNDE1MTMwNTM1WhgPMjAyNTA0MTYxMzA1MzVaMHcw
// SIG // PQYKKwYBBAGEWQoEATEvMC0wCgIFAOuo2B8CAQAwCgIB
// SIG // AAICHOoCAf8wBwIBAAICE3IwCgIFAOuqKZ8CAQAwNgYK
// SIG // KwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgC
// SIG // AQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsF
// SIG // AAOCAQEAu6pSnERiwcK9GO6LyIrHK3NhOhI4fHYADsew
// SIG // APij5ljSBUZxcNXtQkgTUhBgxFwtbpEi6H7Z4eRhaCr8
// SIG // 2mwjj/RjOTGYigH98PY8plj71/j+xgpoX+mYF8Ji9L9n
// SIG // ke5hCoXsq3lpbkueNdYNJGCgOMC6VrdwsTdcooHxkUrT
// SIG // CFncjA0Yb+Esp9jm7sTORUbqMDpN1PuqlT/aBYm+Ogvy
// SIG // Bv5zjsJ2ZjxVLCraPSyfIohnpqT1kXlXa0qsa0lQkJAt
// SIG // wvQCLCNiWKadxZIh1U40zi+I7YkjxzE/pl5oWIHJ0T3g
// SIG // JzsLSWM5oxHNjTsGb5TPq3wKsEm1guSDlwFv/CofwDGC
// SIG // BA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwAhMzAAAB/tCowns0IQsBAAEAAAH+MA0GCWCG
// SIG // SAFlAwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZI
// SIG // hvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEIDdmXpOXk6d6
// SIG // WGkuVC2bpu9DebSI009gFoxhFyrSDYG7MIH6BgsqhkiG
// SIG // 9w0BCRACLzGB6jCB5zCB5DCBvQQgEYXM3fxTyJ8Y0fdp
// SIG // toT1qnPrxjhtfvyNFrZArLcodHkwgZgwgYCkfjB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAf7QqMJ7
// SIG // NCELAQABAAAB/jAiBCAHYe7elml2E+J1N7A/NG+yjZjP
// SIG // r0woM8i8a7hb+T92MzANBgkqhkiG9w0BAQsFAASCAgCL
// SIG // xylpZZ0op6mf6sV4+nXPLTtoKJmXNsuYn8HzJmOOuDKJ
// SIG // cvBGMyHm11PnYCuUQlPl39+hqM5MesgzplpdcdKFLVvP
// SIG // wugrDw+KHEqkRsMZfxa5IGf03T1gL8D45FLEQc86J60P
// SIG // scGoSGnpJFxQAvHJKWjaD9SaiXRr+Il10oJQdxTlygK8
// SIG // 2J6svjd05JGYe5fURNtTqN2q2Psw5kY42EWMCVfNm488
// SIG // XrXTZzOzavrnZF05o/EAzANXZHwcs2VPzUYJnCt403el
// SIG // vLZFw5EGqgN0hjPgvFnQS8eWRzvAceQ3RqYLUHf5AK8x
// SIG // tcFULFzK3g1UuHhVDxXMKD8VY8qCFrnghiAykQqDyJNK
// SIG // sR9vcIwjjZtzHMk26c4w523IntvmhjfvrcN7zZW0c8kU
// SIG // QcbJ48St6zVsQEGJWDnSO0gn+0QGby8skb4xtA28rexx
// SIG // uz/ujWRggL3uvDUwJAXNHQpJmK9fFImPWMq6wx7u8G1C
// SIG // dfDM125dRQqXdXOpSqSoWbxKUHhqjsAeSCCn29rPRezl
// SIG // diXWdyaj7+qD13/DuUU2xwV/PhQ+K77lzUiQzquKUOPM
// SIG // A75bSe2ZXXir6vTD56gJVh/qUWTt1nvIu/xNEqo9ERS4
// SIG // VlDtFgTOD+txi3UfllfoKrRqT12u2thr0YFcirk3yWqk
// SIG // BFMlB63RlPQ36VLBq4cp8w==
// SIG // End signature block
