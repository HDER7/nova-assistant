package com.nova.assistant.soc;

import java.util.List;

public record IocResult(
        List<String> ipv4,
        List<String> domains,
        List<String> urls,
        List<String> emails,
        List<String> md5,
        List<String> sha1,
        List<String> sha256,
        List<String> cves,
        boolean defangedInput,
        int total
) {}
