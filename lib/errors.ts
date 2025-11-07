export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export class UpstreamError extends Error {
  public readonly status: number;
  public readonly upstream: "github" | "openai";

  constructor(
    upstream: "github" | "openai",
    status: number,
    message: string
  ) {
    super(message);
    this.name = "UpstreamError";
    this.upstream = upstream;
    this.status = status;
  }
}
