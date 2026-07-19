import { api } from "./client";
import { endpoints } from "./endpoints";
import type { News, NewsListResponse } from "./types";

export interface ListNewsParams {
  gameId?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

export function listNews(params: ListNewsParams = {}): Promise<NewsListResponse> {
  return api.get<NewsListResponse>(endpoints.news.list, { ...params });
}

export function getNews(newsId: string): Promise<News> {
  return api.get<News>(endpoints.news.detail(newsId));
}

export function toggleNewsLike(newsId: string): Promise<unknown> {
  return api.post(endpoints.news.like(newsId), {});
}
