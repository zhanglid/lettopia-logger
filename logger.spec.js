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
      request(app)
        .post("/test")
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
