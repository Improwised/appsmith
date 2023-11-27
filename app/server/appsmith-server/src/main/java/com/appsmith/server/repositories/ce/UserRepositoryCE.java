package com.appsmith.server.repositories.ce;

import com.appsmith.server.domains.User;
import com.appsmith.server.repositories.BaseRepository;
import com.appsmith.server.repositories.CustomUserRepository;

import java.util.Optional;
import java.util.List;

public interface UserRepositoryCE extends BaseRepository<User, String>, CustomUserRepository {

    Optional<User> findByEmail(String email);

    Optional<User> findByCaseInsensitiveEmail(String email);

    Optional<Long> countByDeletedAtNull();

    Optional<User> findByEmailAndTenantId(String email, String tenantId);
}
