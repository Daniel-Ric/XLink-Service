import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-1234567890";
process.env.CLIENT_ID = process.env.CLIENT_ID || "test-client";

const {generateProofKey, signXboxRequest} = await import("../src/services/xsapiCrypto.service.js");
const {matchTitleData} = await import("../src/services/xsapiNsal.service.js");

test("signXboxRequest returns Xbox signature envelope", () => {
    const {privateJwk} = generateProofKey();
    const signature = signXboxRequest({
        method: "POST",
        url: "https://userpresence.xboxlive.com/users/xuid(1)/devices/current/titles/current",
        authorization: "XBL3.0 x=uhs;token",
        headers: {Authorization: "XBL3.0 x=uhs;token"},
        body: {state: "active"},
        proofKeyJwk: privateJwk,
        policy: {Version: 1}
    });

    const raw = Buffer.from(signature, "base64");
    assert.equal(raw.length, 76);
    assert.equal(raw.readUInt32BE(0), 1);
});

test("matchTitleData resolves fqdn before wildcard", () => {
    const titleData = {
        EndPoints: [{
            Protocol: "https",
            Host: "*.xboxlive.com",
            HostType: "wildcard",
            RelyingParty: "http://xboxlive.com",
            SignaturePolicyIndex: 0
        }, {
            Protocol: "https",
            Host: "sessiondirectory.xboxlive.com",
            HostType: "fqdn",
            RelyingParty: "https://sessiondirectory.xboxlive.com/",
            SignaturePolicyIndex: 1
        }],
        SignaturePolicies: [{Version: 1}, {Version: 2, MaxBodyBytes: 8192}]
    };

    const match = matchTitleData(titleData, "https://sessiondirectory.xboxlive.com/handles");
    assert.equal(match.endpoint.RelyingParty, "https://sessiondirectory.xboxlive.com/");
    assert.equal(match.policy.Version, 2);
});
