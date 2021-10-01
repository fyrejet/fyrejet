"use strict";

/* global describe, it */
const request = require("supertest");
const { createReadStream, readFileSync } = require("fs");
const path = require("path");
const stream = require("stream");

if (process.env.UWS_SERVER_ENABLED_FOR_TEST) {
  describe("uwsCompat - restana - integration", () => {
    const baseUrl = "http://localhost:" + 9999;
    const server = require("../lib/uwsCompat").uwsCompat();
    const service = require("restana")({
      server: server,
      prioRequestsProcessing: false,
    });

    service.get("/string", (req, res) => {
      res.send("Hello World!");
    });

    service.get("/string-override-status", (req, res) => {
      res.statusCode = 250;
      res.send("Hello World!");
    });

    service.get("/html-string", (req, res) => {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send("<p>Hello World!</p>");
    });

    service.get("/buffer", (req, res) => {
      res.send(Buffer.from("Hello World!"));
    });

    service.get("/buffer-string", (req, res) => {
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.send(Buffer.from("Hello World!"));
    });

    service.get("/json", (req, res) => {
      res.send({ id: "restana" });
    });

    service.get("/json-with-content-type", (req, res) => {
      res.setHeader("content-type", "application/json");
      res.send({ id: "restana" });
    });

    service.get("/stream", (req, res) => {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        createReadStream(path.resolve(__dirname, "./fixtures/.name"), {
          encoding: "utf8",
        })
      );
    });

    service.get("/stream-octet", (req, res) => {
      res.send(
        stream.Readable.from(
          (async function* generateTinyStream() {
            yield "Hello ";
            yield "World!";
          })()
        )
      );
    });

    service.get("/promise", (req, res) => {
      res.send(Promise.resolve({ hello: "world" }));
    });

    service.get("/promise-with-headers", (req, res) => {
      res.setHeader("content-type", "application/json");
      res.setHeader("x-framework", "restana");
      res.send(Promise.resolve({ hello: "world" }));
    });

    service.get("/promise-rejected", (req, res) => {
      const error = new Error("Rejected");
      error.code = 503;
      res.setHeader("content-type", "text/html");
      res.send(Promise.reject(error));
    });

    service.get("/invalid-body", (req, res) => {
      res.body = true;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.send();
    });

    service.get("/error", (req, res) => {
      const err = new Error("Test");
      err.code = 501;
      res.send(err);
    });

    it("should start service", async (done) => {
      server.start(9999, (serverSocket) => {
        if (serverSocket) {
          done();
        }
      });
    });

    it("should GET 200 and string content on /string", async () => {
      await request(baseUrl)
        .get("/string")
        .expect(200)
        .expect("content-type", "text/plain; charset=utf-8")
        .expect("Hello World!");
    });

    it("should GET 250 and string content on /string-override-status", async () => {
      await request(baseUrl)
        .get("/string-override-status")
        .expect(250)
        .expect("content-type", "text/plain; charset=utf-8")
        .expect("Hello World!");
    });

    it("should GET 200 and html content on /html-string", async () => {
      await request(baseUrl)
        .get("/html-string")
        .expect(200)
        .expect("content-type", "text/html; charset=utf-8")
        .expect("<p>Hello World!</p>");
    });

    it("should GET 200 and buffer content on /buffer", async () => {
      await request(baseUrl)
        .get("/buffer")
        .expect(200)
        .expect("content-type", "application/octet-stream")
        .expect(Buffer.from("Hello World!"));
    });

    it("should GET 200 and string content on /buffer-string", async () => {
      await request(baseUrl)
        .get("/buffer-string")
        .expect(200)
        .expect("content-type", "text/plain; charset=utf-8")
        .expect("Hello World!");
    });

    it("should GET 200 and json content on /json", async () => {
      await request(baseUrl)
        .get("/json")
        .expect(200)
        .expect("content-type", "application/json; charset=utf-8")
        .expect({ id: "restana" });
    });

    it("should GET 200 and json content on /json-with-content-type", async () => {
      await request(baseUrl)
        .get("/json-with-content-type")
        .expect(200)
        .expect("content-type", "application/json")
        .expect({ id: "restana" });
    });

    it("should GET 200 and html content on /stream", async () => {
      await request(baseUrl)
        .get("/stream")
        .expect(200)
        .expect("content-type", "text/html; charset=utf-8")
        .expect(
          readFileSync(path.resolve(__dirname, "./fixtures/.name"), "utf8")
        );
    });

    it("should GET 200 and buffer content on /stream-octet", async () => {
      await request(baseUrl)
        .get("/stream-octet")
        .expect(200)
        .expect("content-type", "application/octet-stream");
    });

    it("should GET 200 and json content on /promise", async () => {
      await request(baseUrl)
        .get("/promise")
        .expect(200)
        .expect({ hello: "world" })
        .expect("content-type", "application/json; charset=utf-8");
    });

    it("should GET 200 and json content on /promise-with-headers", async () => {
      await request(baseUrl)
        .get("/promise-with-headers")
        .expect(200)
        .expect({ hello: "world" })
        .expect("content-type", "application/json")
        .expect("x-framework", "restana");
    });

    it("should GET 503 and json content on /promise-rejected", async () => {
      await request(baseUrl)
        .get("/promise-rejected")
        .expect(503)
        .expect({ code: 503, message: "Rejected" })
        .expect("content-type", "application/json; charset=utf-8");
    });

    it("should GET 500 and buffer content on /invalid-body", async () => {
      await request(baseUrl).get("/invalid-body").expect(500);
    });

    it("should GET 501 and json content on /error", async () => {
      await request(baseUrl)
        .get("/error")
        .expect(501)
        .expect("content-type", "application/json; charset=utf-8")
        .expect({
          code: 501,
          message: "Test",
        });
    });

    it("should successfully terminate the service", async () => {
      await service.close();
    });
  });
}
