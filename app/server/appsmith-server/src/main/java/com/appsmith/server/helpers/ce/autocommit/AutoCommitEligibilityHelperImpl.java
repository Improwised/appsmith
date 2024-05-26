package com.appsmith.server.helpers.ce.autocommit;

import com.appsmith.server.constants.ArtifactType;
import com.appsmith.server.domains.GitArtifactMetadata;
import com.appsmith.server.domains.Layout;
import com.appsmith.server.dtos.PageDTO;
import com.appsmith.server.helpers.CommonGitFileUtils;
import com.appsmith.server.helpers.DSLMigrationUtils;
import com.appsmith.server.helpers.GitUtils;
import com.appsmith.server.migrations.JsonSchemaVersions;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.minidev.json.JSONObject;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import static java.lang.Boolean.FALSE;
import static java.lang.Boolean.TRUE;

@Slf4j
@Primary
@Component
@RequiredArgsConstructor
public class AutoCommitEligibilityHelperImpl implements AutoCommitEligibiltyHelper {

    private final CommonGitFileUtils commonGitFileUtils;
    private final DSLMigrationUtils dslMigrationUtils;

    @Override
    public Mono<Boolean> isServerAutoCommitRequired(String workspaceId, GitArtifactMetadata gitMetadata) {

        String defaultApplicationId = gitMetadata.getDefaultArtifactId();
        String branchName = gitMetadata.getBranchName();
        String repoName = gitMetadata.getRepoName();

        return commonGitFileUtils
                .getMetadataServerSchemaMigrationVersion(
                        workspaceId, defaultApplicationId, repoName, branchName, ArtifactType.APPLICATION)
                .map(serverSchemaVersion -> {
                    log.info(
                            "server schema for application id {} :  and branch name : {} is : {}",
                            defaultApplicationId,
                            branchName,
                            serverSchemaVersion);
                    return JsonSchemaVersions.serverVersion > serverSchemaVersion ? TRUE : FALSE;
                })
                .defaultIfEmpty(FALSE)
                .onErrorResume(error -> {
                    log.debug(
                            "error while retrieving the metadata for defaultApplicationId : {}, branchName : {} error : {}",
                            defaultApplicationId,
                            branchName,
                            error.getMessage());
                    return Mono.just(FALSE);
                });
    }

    @Override
    public Mono<Boolean> isClientMigrationRequired(PageDTO pageDTO) {
        return dslMigrationUtils
                .getLatestDslVersion()
                .map(latestDslVersion -> {
                    // ensuring that the page has only one layout, as we don't support multiple layouts yet
                    // when multiple layouts are supported, this code will have to be updated
                    assert pageDTO.getLayouts().size() == 1;
                    Layout layout = pageDTO.getLayouts().get(0);
                    JSONObject layoutDsl = layout.getDsl();
                    return GitUtils.isMigrationRequired(layoutDsl, latestDslVersion);
                })
                .defaultIfEmpty(FALSE)
                .onErrorResume(error -> {
                    log.debug("Error fetching latest DSL version");
                    return Mono.just(Boolean.FALSE);
                });
    }

    @Override
    public Mono<AutoCommitTriggerDTO> isAutoCommitRequired(
            String workspaceId, GitArtifactMetadata gitArtifactMetadata, PageDTO pageDTO) {

        Mono<Boolean> isClientAutocommitRequiredMono =
                isClientMigrationRequired(pageDTO).defaultIfEmpty(FALSE);

        Mono<Boolean> isServerAutocommitRequiredMono = isServerAutoCommitRequired(workspaceId, gitArtifactMetadata);

        return isServerAutocommitRequiredMono
                .zipWith(isClientAutocommitRequiredMono)
                .map(tuple2 -> {
                    Boolean serverFlag = tuple2.getT1();
                    Boolean clientFlag = tuple2.getT2();

                    AutoCommitTriggerDTO autoCommitTriggerDTO = new AutoCommitTriggerDTO();
                    autoCommitTriggerDTO.setIsClientAutoCommitRequired(TRUE.equals(clientFlag));
                    autoCommitTriggerDTO.setIsServerAutoCommitRequired(TRUE.equals(serverFlag));
                    autoCommitTriggerDTO.setIsAutoCommitRequired((TRUE.equals(serverFlag) || TRUE.equals(clientFlag)));
                    return autoCommitTriggerDTO;
                });
    }
}
