use crate::cache::IntegrityCache;
use crate::config::Config;
use crate::errors::AppError;
use crate::parsing::{filter_current, load_all_instances};
use crate::proxy::get_or_resolve_proxy_info;

pub async fn resolve_contract_family(
    config: &Config,
    cache: &IntegrityCache,
    canonical_name: &str,
) -> Result<Vec<String>, AppError> {
    let instances = load_all_instances(&config.broadcast_path, &config.out_path)?;
    let current = filter_current(instances);

    let mut family = vec![canonical_name.to_string()];

    for instance in &current {
        if instance.contract_name.eq_ignore_ascii_case(canonical_name) {
            continue; // already in family
        }

        let info = get_or_resolve_proxy_info(config, cache, instance.chain, &instance.address).await;

        if info.is_proxy && info.implementation_contract_name.as_deref() == Some(canonical_name) {
            family.push(instance.contract_name.clone());
        }
    }

    family.sort_unstable();
    family.dedup();
    Ok(family)
}