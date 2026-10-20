/** A definitive supplier rejection, as opposed to an unknown network outcome. */
export class EsimAccessApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EsimAccessApiError";
  }
}
