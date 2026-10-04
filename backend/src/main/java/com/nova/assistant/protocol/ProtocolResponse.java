package com.nova.assistant.protocol;

import java.util.UUID;

/** A protocol as shown in the UI. Built-in protocols have no id and can't be edited (but can be overridden by name). */
public record ProtocolResponse(UUID id, String name, String steps, boolean builtIn) {
    static ProtocolResponse from(Protocol p) {
        return new ProtocolResponse(p.getId(), p.getName(), p.getSteps(), false);
    }
}
