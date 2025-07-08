interface BaseSelection {
    response: any;
    params: string | never;
}

interface BaseSchema {
    selections: Record<string, BaseSelection>;
}

/* MARKER: types */
type SectionsV1Map = {};
type SectionsV2Map = {};

enum TornApiError {}

/* MARKER END: types */

export type SectionV1 = keyof SectionsV1Map;
export type SectionV2 = keyof SectionsV2Map;
export type SelectionV1<Sec extends SectionV1> = keyof SectionsV1Map[Sec]["selections"];
export type SelectionV2<Sec extends SectionV2> = keyof SectionsV2Map[Sec]["selections"];

export type ParamsV1<Sec extends SectionV1, Sel extends SelectionV1<Sec>> = SectionsV1Map[Sec]["selections"][Sel] extends {
    params: any;
}
    ? SectionsV1Map[Sec]["selections"][Sel]["params"]
    : never;
export type ParamsV2<Sec extends SectionV2, Sel extends SelectionV2<Sec>> = SectionsV2Map[Sec]["selections"][Sel] extends {
    params: any;
}
    ? SectionsV2Map[Sec]["selections"][Sel]["params"]
    : never;

export type GetArgumentV1<Sec extends SectionV1, Sel extends keyof SectionsV1Map[Sec]["selections"]> =
    ParamsV1<Sec, Sel> extends never
        ? {
              section: Sec;
              selections?: Sel[];
              id?: string | number;
              params?: never;
              key: string;
              comment?: string;
          }
        : {
              section: Sec;
              selections?: Sel[];
              id?: string | number;
              params?: Partial<Record<ParamsV1<Sec, Sel>, string>>;
              key: string;
              comment?: string;
          };
export type GetArgumentV2<Sec extends SectionV2, Sel extends keyof SectionsV2Map[Sec]["selections"]> =
    ParamsV2<Sec, Sel> extends never
        ? {
              section: Sec;
              selections?: Sel[];
              id?: string | number;
              params?: never;
              key: string;
              comment?: string;
          }
        : {
              section: Sec;
              selections?: Sel[];
              id?: string | number;
              params?: Partial<Record<ParamsV2<Sec, Sel>, string>>;
              key: string;
              comment?: string;
          };

export type GetResponseSuccessV1<Sec extends SectionV1, Sel extends keyof SectionsV1Map[Sec]["selections"]> = SectionsV1Map[Sec]["selections"][Sel] extends {
    response: any;
}
    ? UnionToIntersection<SectionsV1Map[Sec]["selections"][Sel]["response"]>
    : never;
export type GetResponseSuccessV2<Sec extends SectionV2, Sel extends keyof SectionsV2Map[Sec]["selections"]> = SectionsV2Map[Sec]["selections"][Sel] extends {
    response: any;
}
    ? UnionToIntersection<SectionsV2Map[Sec]["selections"][Sel]["response"]>
    : never;
export type GetResponseError = { error: { code: TornApiError; error: string } };
export type GetResponseV1<Sec extends SectionV1, Sel extends keyof SectionsV1Map[Sec]["selections"]> = GetResponseSuccessV1<Sec, Sel> | GetResponseError;
export type GetResponseV2<Sec extends SectionV2, Sel extends keyof SectionsV2Map[Sec]["selections"]> = GetResponseSuccessV2<Sec, Sel> | GetResponseError;

export type CacheV1<Sec extends SectionV1, Sel extends keyof SectionsV1Map[Sec]["selections"]> = {
    get: (key: GetArgumentV1<Sec, Sel>) => GetResponseV1<Sec, Sel> | null | Promise<GetResponseV1<Sec, Sel> | null>;
    /** @param expiry {string} an epoch timestamp, in ms  */
    set: (key: GetArgumentV1<Sec, Sel>, value: GetResponseV1<Sec, Sel>, expiry: number) => void | Promise<void>;
};
export type CacheV2<Sec extends SectionV2, Sel extends keyof SectionsV2Map[Sec]["selections"]> = {
    get: (key: GetArgumentV2<Sec, Sel>) => GetResponseV2<Sec, Sel> | null | Promise<GetResponseV2<Sec, Sel> | null>;
    /** @param expiry {string} an epoch timestamp, in ms  */
    set: (key: GetArgumentV2<Sec, Sel>, value: GetResponseV2<Sec, Sel>, expiry: number) => void | Promise<void>;
};

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

export async function tornApiGetV1<Sec extends SectionV1, Sel extends SelectionV1<Sec>>({
    section,
    selections,
    id,
    params = {} as any,
    key,
    comment,
    cache,
    expiry,
}: GetArgumentV1<Sec, Sel> & {
    cache?: CacheV1<Sec, Sel>;
    expiry?: number;
}): Promise<GetResponseV1<Sec, Sel>> {
    const cached = await cache?.get({
        section,
        selections,
        id,
        params,
        key,
    } as GetArgumentV1<Sec, Sel>);
    if (cached) return cached;

    const url = new URL(`https://api.torn.com/${section}/${id ?? ""}`);
    selections?.length && url.searchParams.set("selections", selections.join(","));
    url.searchParams.set("key", key);
    if (comment) url.searchParams.set("comment", comment);
    Object.entries<string>(params as any).forEach(([k, v]) => url.searchParams.set(k, v));

    return await fetch(url)
        .then((res) => res.json())
        .then(addToCache)
        .catch(handleError);

    function handleError(e: unknown) {
        console.error(e);
        return { error: { code: -1, error: generateErrorString(e) } };

        function generateErrorString(e: unknown): string {
            switch (typeof e) {
                case "string":
                    return e;
                case "object": {
                    if (e instanceof Error) return e.message;
                    return JSON.stringify(e);
                }
                default:
                    return (e as any).toString();
            }
        }
    }

    function addToCache(response: GetResponseV1<Sec, Sel>): GetResponseV1<Sec, Sel> {
        if ("error" in (response as any)) return response;
        cache?.set(
            {
                section,
                selections,
                id,
                params,
                key,
            } as GetArgumentV1<Sec, Sel>,
            response,
            expiry ?? Date.now() + 30_000,
        );
        return response;
    }
}
export async function tornApiGetV2<Sec extends SectionV2, Sel extends SelectionV2<Sec>>({
    section,
    selections,
    id,
    params = {} as any,
    key,
    comment,
    cache,
    expiry,
}: GetArgumentV2<Sec, Sel> & {
    cache?: CacheV2<Sec, Sel>;
    expiry?: number;
}): Promise<GetResponseV2<Sec, Sel>> {
    const cached = await cache?.get({
        section,
        selections,
        id,
        params,
        key,
    } as GetArgumentV2<Sec, Sel>);
    if (cached) return cached;

    const url = new URL(`https://api.torn.com/v2/${section}/${id ?? ""}`);
    selections?.length && url.searchParams.set("selections", selections.join(","));
    url.searchParams.set("key", key);
    if (comment) url.searchParams.set("comment", comment);
    Object.entries<string>(params as any).forEach(([k, v]) => url.searchParams.set(k, v));

    return await fetch(url)
        .then((res) => res.json())
        .then(addToCache)
        .catch(handleError);

    function handleError(e: unknown) {
        console.error(e);
        return { error: { code: -1, error: generateErrorString(e) } };

        function generateErrorString(e: unknown): string {
            switch (typeof e) {
                case "string":
                    return e;
                case "object": {
                    if (e instanceof Error) return e.message;
                    return JSON.stringify(e);
                }
                default:
                    return (e as any).toString();
            }
        }
    }

    function addToCache(response: GetResponseV2<Sec, Sel>): GetResponseV2<Sec, Sel> {
        if ("error" in (response as any)) return response;
        cache?.set(
            {
                section,
                selections,
                id,
                params,
                key,
            } as GetArgumentV2<Sec, Sel>,
            response,
            expiry ?? Date.now() + 30_000,
        );
        return response;
    }
}
