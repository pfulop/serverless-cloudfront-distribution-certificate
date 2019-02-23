# serverless-cloudfront-distribution-certificate

This serverless plugin manages to create certificate for specified cloudfront distribution. It also handles validation trough dns and ROUTE 53.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm version](https://badge.fury.io/js/serverless-cloudfront-distribution-certificate.svg)](https://badge.fury.io/js/erverless-cloudfront-distribution-certificate)
[![MIT licensed](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/pfulop/serverless-cloudfront-distribution-certificate/master/LICENSE)

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
