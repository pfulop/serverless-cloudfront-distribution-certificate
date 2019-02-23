# serverless-cloudfront-distribution

This serverless plugin manages to create certificate for specified cloudfront distribution. It also handles validation trough dns and ROUTE 53.

![NPM](https://img.shields.io/npm/l/serverless-cloudfront-distribution.svg)

![npm](<https://img.shields.io/npm/v/![NPM](https://img.shields.io/npm/l/serverless-cloudfront-distribution.svg).svg>)

![node](<https://img.shields.io/node/v/![npm](https://img.shields.io/npm/v/![NPM](https://img.shields.io/npm/l/serverless-cloudfront-distribution.svg).svg).svg>)

## Usage

### instalation

```bash
npm i serverless-cloudfront-distribution --save-dev
```

### then in your serverless config

```yaml
plugins:
  - serverless-cloudfront-distribution-certificate

custom:
  cfdDomain:
    domainName: "best.example.ever"
    cloudFront: WebsiteDistribution
```

Where domainName is the domain for which ssl certificate should be generated and cloudFront is the logical name of your cloudfront distribution.
