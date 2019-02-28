const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const proxyquire = require("proxyquire");
const express = require("express");
const request = require("supertest");
const bodyParser = require("body-parser");

describe("logger test", () => {
  describe("development", () => {
    let logger = null;
    let spyOnLog = null;
    before(() => {
      logger = proxyquire("./logger", {
        "./utils": {
          getEnv: () => "development"
        }
      });
      spyOnLog = sinon.spy(logger.transports[0], "log");
    });

    afterEach(() => {
      spyOnLog.resetHistory();
    });

    it("logger should be an object", () => {
      expect(logger).to.be.an("object");
    });

    it("it should have info function", () => {
      logger.info("lime project");
      expect(spyOnLog).to.be.called;
      expect(spyOnLog.lastCall.args[0]).to.include({
        message: "lime project"
      });
    });

    it("should record time", () => {
      logger.info("lime project");
      expect(spyOnLog.lastCall.args[0]).to.have.property("timestamp");
    });

    it("should record http request", done => {
      const app = express();
      const next = sinon.fake();
      app.use(bodyParser.json());
      app.use(logger.expressRequestHandler);
      app.post(
        "/test",
        function(req, res, next) {
          res.send("test res");
        },
        next
      );
      const headers = {
        accept: "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "zh-CN,zh;q=0.9",
        connection: "Keep-Alive",
        host: "gcloud-api.lettopia.com",
        "if-none-match": "W/'1cf-FP3HO2DuRrrpDQrETqIvFic2NNY'",
        origin: "https://admin.lettopia.com",
        referer: "https://admin.lettopia.com/order",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.119 Safari/537.36",
        via: "1.1 google",
        "x-cloud-trace-context":
          "535f61abd8e53e03613b388b0e6d9fa2/11817843603185438380",
        "x-forwarded-for": "47.156.137.59, 35.244.219.128",
        "x-forwarded-proto": "https"
      };
      request(app)
        .post("/test")
        .set(headers)
        .expect(200)
        .end(() => {
          expect(spyOnLog.lastCall.args[0]).to.have.property("httpRequest");
          done();
        });
    });

    it("should record graphql request", done => {
      const app = express();
      const next = sinon.fake();
      app.use(bodyParser.json());
      app.use(logger.expressRequestHandler);
      app.post(
        "/test",
        function(req, res, next) {
          res.send("test res");
        },
        next
      );
      request(app)
        .post("/test")
        .send({
          query: "{\n userMe {\n email\n _id\n balance {\n balance\n }\n }\n}\n"
        })
        .expect(200)
        .end(() => {
          expect(spyOnLog.lastCall.args[0]).to.have.property("httpRequest");
          expect(spyOnLog.lastCall.args[0].httpRequest).to.have.property(
            "gqlQuery"
          );
          done();
        });
    });

    it("should record user", done => {
      const app = express();
      const next = sinon.fake();
      app.use(bodyParser.json());
      app.use((req, res, next) => {
        req.user = {
          email: "test@gmai.com"
        };
        next();
      });
      app.use(logger.expressRequestHandler);
      app.post(
        "/test",
        function(req, res, next) {
          res.send("test res");
        },
        next
      );
      request(app)
        .post("/test")
        .send({
          query: "{\n userMe {\n email\n _id\n balance {\n balance\n }\n }\n}\n"
        })
        .expect(200)
        .end(() => {
          expect(spyOnLog.lastCall.args[0].httpRequest).to.have.property(
            "user"
          );
          done();
        });
    });

    it("should log error", () => {
      logger.error(new Error("this is an error"));
      expect(spyOnLog.lastCall.args[0]).to.have.include({
        message: "this is an error"
      });
      expect(spyOnLog.lastCall.args[0]).to.have.property("stack");
    });

    it("express error handler", done => {
      const app = express();
      const next = sinon.fake();
      app.get(
        "/test",
        function(req, res, next) {
          throw new Error("test error");
        },
        next
      );
      app.use(logger.expressErrorHandler);
      request(app)
        .get("/test")
        .expect(500)
        .end(() => {
          done();
        });
    });
  });

  describe("GcloudKube env", () => {
    let logger = null;
    const fakeGcloudTraceAgent = sinon.fake();

    before(() => {
      logger = proxyquire("./logger", {
        "@google-cloud/trace-agent": {
          start: fakeGcloudTraceAgent
        },
        "./utils": {
          getEnv: () => "GcloudKube"
        }
      });
    });

    it("should call gcloud trace agent", () => {
      expect(fakeGcloudTraceAgent).to.be.calledOnce;
    });
  });
});
