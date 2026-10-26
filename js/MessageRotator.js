// Displays a single message (one quote per page load — no rotation).
export class MessageRotator {
  constructor(board, messages) {
    this.board = board;
    this.messages = messages;
  }

  start() { this.next(); }

  next() { this.board.displayMessage(this.messages[0]); }

  prev() { this.next(); }
}
