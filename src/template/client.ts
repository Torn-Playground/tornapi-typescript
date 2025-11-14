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

export type CommonArgument = {
    id?: string | number;
    key: string;
    comment?: string;
};
export type CommonArgumentV1<Sec extends SectionV1, Sel extends keyof SectionsV1Map[Sec]["selections"]> = {
    section: Sec;
    selections?: Sel[];
} & CommonArgument;
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
export type CommonArgumentV2<Sec extends SectionV2, Sel extends keyof SectionsV2Map[Sec]["selections"]> = {
    section: Sec;
    selections?: Sel[];
} & CommonArgument;
export type GetArgumentV2<Sec extends SectionV2, Sel extends keyof SectionsV2Map[Sec]["selections"]> =
    ParamsV2<Sec, Sel> extends never
        ? {
              params?: never;
          } & CommonArgumentV2<Sec, Sel>
        : {
              params?: Partial<Record<ParamsV2<Sec, Sel>, string>>;
          } & CommonArgumentV2<Sec, Sel>;
export type AdditionalArguments<CacheType> = {
    cache?: CacheType;
    expiry?: number;
    timeout?: number;
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

export abstract class HTTPClient {
    abstract getJson(url: string): Promise<any>;

    canAbort(): this is AbortableHTTPClient {
        return false;
    }
}

export abstract class AbortableHTTPClient extends HTTPClient {
    abstract getJson(url: string): Promise<any>;
    abstract getJson(url: string, timeout: number): Promise<any>;
    abstract getJson(url: string, timeout: number | undefined): Promise<any>;

    canAbort(): this is AbortableHTTPClient {
        return true;
    }
}

export class FetchHTTPClient extends AbortableHTTPClient {
    async getJson(url: string, timeout: number | undefined = undefined): Promise<any> {
        let response: Response;
        if (timeout !== undefined) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
        } else {
            response = await fetch(url);
        }

        return await response.json();
    }
}

interface ClientOptions {
    httpClient?: HTTPClient;
    defaultComment?: string;
    defaultTimeout?: number;
}

export class TornApiClient {
    private readonly httpClient: HTTPClient;
    private readonly defaultComment?: string;
    private readonly defaultTimeout?: number;

    constructor(options: ClientOptions = {}) {
        this.httpClient = options.httpClient ?? new FetchHTTPClient();
        this.defaultComment = options.defaultComment;
        this.defaultTimeout = options.defaultTimeout;
    }

    async getV1<Sec extends SectionV1, Sel extends SelectionV1<Sec>>({
        section,
        selections,
        id,
        params = {} as any,
        key,
        comment,
        cache,
        expiry,
        timeout,
    }: GetArgumentV1<Sec, Sel> & AdditionalArguments<CacheV1<Sec, Sel>>): Promise<GetResponseV1<Sec, Sel>> {
        const cached = await cache?.get({
            section,
            selections,
            id,
            params,
            key,
        } as GetArgumentV1<Sec, Sel>);
        if (cached) return cached;

        let url = `https://api.torn.com/${section}/${id ?? ""}`;
        url = this.populateUrl(url, key, (selections ?? []) as string[], comment, params ?? {});

        if (this.httpClient.canAbort() && typeof timeout === "number") {
            return (this.httpClient as AbortableHTTPClient).getJson(url, timeout).then(addToCache).catch(this.handleError);
        } else {
            return this.httpClient.getJson(url).then(addToCache).catch(this.handleError);
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

    async getV2<Sec extends SectionV2, Sel extends SelectionV2<Sec>>({
        section,
        selections,
        id,
        params = {} as any,
        key,
        comment,
        cache,
        expiry,
        timeout,
    }: GetArgumentV2<Sec, Sel> & AdditionalArguments<CacheV2<Sec, Sel>>): Promise<GetResponseV2<Sec, Sel>> {
        const cached = await cache?.get({
            section,
            selections,
            id,
            params,
            key,
        } as GetArgumentV2<Sec, Sel>);
        if (cached) return cached;

        let url = `https://api.torn.com/v2/${section}/${id ?? ""}`;
        url = this.populateUrl(url, key, (selections ?? []) as string[], comment, params ?? {});

        if (this.httpClient.canAbort() && typeof timeout === "number") {
            return (this.httpClient as AbortableHTTPClient).getJson(url, timeout).then(addToCache).catch(this.handleError);
        } else {
            return this.httpClient.getJson(url).then(addToCache).catch(this.handleError);
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

    private handleError(error: unknown) {
        console.error(error);
        return { error: { code: -1, error: generateErrorString(error) } };

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

    private populateUrl(url: string, key: string, selections: string[], comment: string | undefined, params: Record<string, string | undefined>): string {
        const allParams: Record<string, string | undefined> = {
            key,
            comment: comment ?? this.defaultComment,
            selections: selections.length ? selections.join(",") : undefined,
            ...params,
        };

        const query = Object.entries(allParams)
            .filter<[string, string]>((entry): entry is [string, string] => !!entry[1])
            .map(([key, value]) => `${key}=${value}`)
            .join("&");

        return `${url}?${query}`
    }
}
