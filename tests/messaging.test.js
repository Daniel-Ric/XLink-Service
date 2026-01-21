import test from "node:test";
import assert from "node:assert/strict";

import {buildMarketplaceMessageEventsPayload, buildMarketplaceMessagingPayload} from "../src/services/minecraft.service.js";

test("buildMarketplaceMessagingPayload uses defaults", () => {
    const {payload, sessionId} = buildMarketplaceMessagingPayload({});
    assert.ok(sessionId);
    assert.equal(payload.sessionId, sessionId);
    assert.equal(payload.sessionContext, "");
    assert.ok(!Object.prototype.hasOwnProperty.call(payload, "previousSessionId"));
    assert.ok(!Object.prototype.hasOwnProperty.call(payload, "continuationToken"));
});

test("buildMarketplaceMessagingPayload respects options", () => {
    const options = {
        sessionId: "9d33d3c4-7780-178b-c84c-e3ad03d74b4f",
        previousSessionId: "b1d54ee7-4aef-0b79-92c8-cf7ee5f88cf3",
        continuationToken: "token",
        sessionContext: "context"
    };

    const {payload, sessionId} = buildMarketplaceMessagingPayload(options);
    assert.equal(sessionId, options.sessionId);
    assert.deepEqual(payload, {
        sessionId: options.sessionId,
        sessionContext: options.sessionContext,
        previousSessionId: options.previousSessionId,
        continuationToken: options.continuationToken
    });
});

test("buildMarketplaceMessageEventsPayload builds single event", () => {
    const {payload, sessionId} = buildMarketplaceMessageEventsPayload({
        sessionId: "9d33d3c4-7780-178b-c84c-e3ad03d74b4f",
        eventType: "Impression",
        instanceId: "82ef0531-346b-42a9-9f15-420775aeb31d_1768990410_flightmessage",
        reportId: "82ef0531-346b-42a9-9f15-420775aeb31d_1768990410_flightmessage",
        continuationToken: "token"
    });

    assert.equal(sessionId, "9d33d3c4-7780-178b-c84c-e3ad03d74b4f");
    assert.equal(payload.SessionId, sessionId);
    assert.equal(payload.SessionContext, "");
    assert.equal(payload.continuationToken, "token");
    assert.deepEqual(payload.events, [{
        eventType: "Impression",
        instanceId: "82ef0531-346b-42a9-9f15-420775aeb31d_1768990410_flightmessage",
        reportId: "82ef0531-346b-42a9-9f15-420775aeb31d_1768990410_flightmessage",
        sessionId
    }]);
});

test("buildMarketplaceMessageEventsPayload builds multiple events", () => {
    const {payload, sessionId} = buildMarketplaceMessageEventsPayload({
        sessionId: "9d33d3c4-7780-178b-c84c-e3ad03d74b4f",
        events: [{
            eventType: "Delete",
            instanceId: "0637ecaa-b767-4cb9-9b2f-ebefe7817be2",
            reportId: "report",
            eventDateTime: "2026-01-21T10:14:44.051Z"
        }]
    });

    assert.equal(payload.SessionId, sessionId);
    assert.equal(payload.SessionContext, "");
    assert.deepEqual(payload.events, [{
        eventType: "Delete",
        instanceId: "0637ecaa-b767-4cb9-9b2f-ebefe7817be2",
        reportId: "report",
        sessionId,
        eventDateTime: "2026-01-21T10:14:44.051Z"
    }]);
});
