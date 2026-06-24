package com.nova.assistant.soc;

import com.nova.assistant.ai.AiService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** AI-assisted SOC analyses, separate from SocService to keep the bean graph acyclic. */
@Service
@RequiredArgsConstructor
public class SocAiService {

    private static final String TRIAGE_SYSTEM = """
            Eres un analista SOC senior (Tier 2/3). Analiza el log, evento o alerta proporcionado y devuelve:
            1) Resumen de lo ocurrido. 2) Severidad estimada (Informativa/Baja/Media/Alta/Critica) con justificacion.
            3) IOCs relevantes detectados. 4) Mapeo a tecnicas MITRE ATT&CK (IDs Txxxx) cuando aplique.
            5) Probabilidad de falso positivo. 6) Acciones de contencion e investigacion recomendadas.
            Responde en espanol, estructurado y conciso, util para un turno de SOC.
            """;

    private static final String PHISHING_SYSTEM = """
            Eres un analista de seguridad especializado en phishing. Analiza el correo (cabeceras y/o cuerpo):
            evalua SPF/DKIM/DMARC si aparecen, dominios y enlaces sospechosos, suplantacion de marca/remitente,
            sentido de urgencia y senuelos. Extrae IOCs (remitente, URLs, dominios, IPs). Asigna un veredicto
            (Legitimo/Sospechoso/Phishing) y un nivel de riesgo (Bajo/Medio/Alto). Recomienda acciones.
            Responde en espanol, estructurado.
            """;

    private final AiService aiService;

    public SocAnalysis triage(String content) { return new SocAnalysis(aiService.oneShot(TRIAGE_SYSTEM, content)); }
    public SocAnalysis phishing(String content) { return new SocAnalysis(aiService.oneShot(PHISHING_SYSTEM, content)); }
}
