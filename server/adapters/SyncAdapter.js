export class SyncAdapter {
  getId() {
    throw new Error('SyncAdapter.getId() not implemented');
  }

  async listQuests() {
    throw new Error('SyncAdapter.listQuests() not implemented');
  }

  async markComplete(_sourceRef) {
    throw new Error('SyncAdapter.markComplete() not implemented');
  }

  async healthCheck() {
    throw new Error('SyncAdapter.healthCheck() not implemented');
  }
}

export class ConflictError extends Error {
  constructor(message = 'quest_changed') {
    super(message);
    this.code = 'CONFLICT';
  }
}
