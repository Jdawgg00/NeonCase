export class InsufficientFundsError extends Error {
  constructor(message = 'Ikke nok credits') {
    super(message)
    this.name = 'InsufficientFundsError'
  }
}

export class AlreadyClaimedError extends Error {
  constructor(message = 'Allerede krevd') {
    super(message)
    this.name = 'AlreadyClaimedError'
  }
}

export class ConcurrencyError extends Error {
  constructor(message = 'Samtidig endring — prøv igjen') {
    super(message)
    this.name = 'ConcurrencyError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotOwnerError extends Error {
  constructor(message = 'Du eier ikke dette objektet') {
    super(message)
    this.name = 'NotOwnerError'
  }
}

export class ItemNotAvailableError extends Error {
  constructor(message = 'Objektet er låst eller allerede listet') {
    super(message)
    this.name = 'ItemNotAvailableError'
  }
}

export class ListingUnavailableError extends Error {
  constructor(message = 'Annonsen er ikke lenger tilgjengelig') {
    super(message)
    this.name = 'ListingUnavailableError'
  }
}

export class CannotBuyOwnListingError extends Error {
  constructor(message = 'Du kan ikke kjøpe din egen annonse') {
    super(message)
    this.name = 'CannotBuyOwnListingError'
  }
}
