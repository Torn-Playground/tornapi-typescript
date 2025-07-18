# TornAPI Typescript

[![NPM Version](https://img.shields.io/npm/v/tornapi-typescript)](https://www.npmjs.com/package/tornapi-typescript)
[![NPM Downloads](https://img.shields.io/npm/d18m/tornapi-typescript)](https://www.npmjs.com/package/tornapi-typescript)

Automatically generated type definition in TypeScript for [torn.com](https://torn.com) API V2. Includes a client for
both API V1 and V2.

## Installation

`npm i -D tornapi-typescript`

## Generation

### V1 types

Based on data provided by [tornapi-documentation](https://github.com/Torn-Playground/tornapi-documentation). Code mostly
provided from [Kwack's V1 wrapper](https://www.npmjs.com/package/@kwack-dev/tornapi). These types are not available
without using the client.

### V1 client

Code mostly provided from [Kwack's V1 wrapper](https://www.npmjs.com/package/@kwack-dev/tornapi). Uses the types as
generated above.

### V2 types

The V2 types are generated in the following way:

* load [openapi specification](https://www.torn.com/swagger/openapi.json)
* convert the specification to TypeScript definitions using [typeconv](https://github.com/grantila/typeconv)
* clean the type definitions
    * remove all "[key: string]: any;", because typeconv adds it everywhere for some reason
    * remove all empty objects (caused by the above cleaning)
    * run through prettier to have it look decent

### V2 client

Code mostly provided from [Kwack's V1 wrapper](https://www.npmjs.com/package/@kwack-dev/tornapi).

## Contact

You can join the community in [our Discord server](https://discord.gg/2wb7GKN). There you can discuss anything related
to the Torn API or other tools related to Torn. Issues can also be reported there, or as GitHub issue.
