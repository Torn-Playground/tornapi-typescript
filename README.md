# TornAPI Typescript

Automatically generated type definition in Typescript for [torn.com](https://torn.com) API V2.

## Installation

`npm i -D tornapi-typescript`

## Generation

These types are generated in the following way:

* load [openapi specification](https://www.torn.com/swagger/openapi.json)
* clean the specification for better types
  * remove `type` when `allOf` is present, otherwise the specification is not valid
  * remove `type` when `oneOf` is present, for improved types
  * mark all fields as required, for improved types
* convert the specification to Typescript definitions using [typeconv](https://github.com/grantila/typeconv)
* clean the type definitions
  * remove all "[key: string]: any;", because typeconv adds it everywhere for some reason
  * remove all empty objects (caused by the above cleaning)
  * run through prettier to have it look decent

## Contact

You can join the community in [our Discord server](https://discord.gg/2wb7GKN). There you can discuss anything related
to the Torn API, or other tools related to Torn. Issues can also be reported there, or as GitHub issue.
