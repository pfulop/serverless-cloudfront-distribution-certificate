# serverless-cloudfront-distribution-certificate

This serverless plugin manages to create certificate for specified CloudFront distribution. It also handles validation trough dns and ROUTE 53.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm version](https://badge.fury.io/js/serverless-cloudfront-distribution-certificate.svg)](https://badge.fury.io/js/serverless-cloudfront-distribution-certificate)
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
    domainNames:
      - "serverless.example.com"
      - "server.example.com"
      - "doggo.example.com"
    cloudFront: CloudFrontDistribution
    minimumProtocolVersion: TLSv1.2_2018
```

Where `domainNames` are domains for which ssl certificate should be generated, `cloudFront` is the logical name of your CloudFront distribution, and `minimumProtocolVersion` is the ViewerCertificate's [MinimumProtocolVersion](https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_ViewerCertificate.html#cloudfront-Type-ViewerCertificate-MinimumProtocolVersion) setting (optional).

## Note

_To use an ACM Certificate with CloudFront, you must request the certificate in the US East (N. Virginia) region. ACM Certificates in this region that are associated with a CloudFront distribution are distributed to all the geographic locations configured for that distribution._

_This plugin will wait up to 15 minutes for certificate to be issued. If the state won't be issued within 15 minutes, it will fail._
