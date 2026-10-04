package com.nova.assistant.protocol;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProtocolRepository extends JpaRepository<Protocol, UUID> {
    List<Protocol> findByUser_IdOrderByNameAsc(UUID userId);
    Optional<Protocol> findByIdAndUser_Id(UUID id, UUID userId);
}
