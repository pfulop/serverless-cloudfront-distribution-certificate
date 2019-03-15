# serverless-cloudfront-distribution-certificate

This serverless plugin manages to create certificate for specified CloudFront distribution. It also handles validation trough dns and ROUTE 53.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm version](https://badge.fury.io/js/serverless-cloudfront-distribution-certificate.svg)](https://badge.fury.io/js/erverless-cloudfront-distribution-certificate)
[![MIT licensed](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/pfulop/serverless-cloudfront-distribution-certificate/master/LICENSE)

## Usage

### Installation

```bash
npm install serverless-cloudfront-distribution-certificate --save-dev
```

### Configuration

```yaml
plugins:
  - serverless-cloudfront-distribution-certificate

custom:
  cfdDomain:
    domainName: "serverless.example.com"
    cloudFront: CloudFrontDistribution
```

Where `domainName` is the domain for which ssl certificate should be generated and `cloudFront` is the logical name of your CloudFront distribution.
