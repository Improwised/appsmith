package com.appsmith.server.domains;

import com.appsmith.external.helpers.CustomJsonType;
import com.appsmith.external.models.BaseDomain;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Transient;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import lombok.experimental.FieldNameConstants;
import org.hibernate.annotations.Type;

@Getter
@Setter
@ToString
@NoArgsConstructor
@Entity
@FieldNameConstants
public class Tenant extends BaseDomain {

    @Column(unique = true)
    String slug;

    String displayName;

    @Transient
    String instanceId;

    PricingPlan pricingPlan;

    @Type(CustomJsonType.class)
    @Column(columnDefinition = "jsonb")
    TenantConfiguration tenantConfiguration;

    // TODO add SSO and other configurations here after migrating from environment variables to database configuration

    public static final class Fields extends BaseDomain.Fields {}
}
