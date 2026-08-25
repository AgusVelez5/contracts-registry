use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
    pub available_chains: Vec<u64>,
}

pub fn paginate<T>(items: Vec<T>, page: usize, page_size: usize) -> (Vec<T>, usize) {
    let total = items.len();
    let page = page.max(1);
    let page_size = page_size.max(1);
    let start = (page - 1) * page_size;
    let paged = items.into_iter().skip(start).take(page_size).collect();
    (paged, total)
}