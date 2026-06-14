package com.nova.assistant.soc;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/soc")
@RequiredArgsConstructor
public class SocController {

    private final SocService socService;

    @PostMapping("/iocs")
    public IocResult iocs(@Valid @RequestBody TextPayload payload) {
        return socService.extractIocs(payload.text());
    }

    @PostMapping("/decode")
    public DecodeResult decode(@Valid @RequestBody DecodePayload payload) {
        return socService.decode(payload.input(), payload.mode());
    }

    @GetMapping("/cve/{id}")
    public CveResult cve(@PathVariable String id) {
        return socService.cveLookup(id);
    }

    @PostMapping("/triage")
    public SocAnalysis triage(@Valid @RequestBody TextPayload payload) {
        return socService.triage(payload.text());
    }

    @PostMapping("/phishing")
    public SocAnalysis phishing(@Valid @RequestBody TextPayload payload) {
        return socService.phishing(payload.text());
    }

    @PostMapping("/vt")
    public VtResult virusTotal(@Valid @RequestBody VtPayload payload) {
        return socService.enrichVt(payload.indicator());
    }
}
