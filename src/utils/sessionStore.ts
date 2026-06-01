export class SessionStore {
  private static _email = '';
  private static _password = '';
  private static _name = '';

  static get email() { return this._email; }
  static get password() { return this._password; }
  static get name() { return this._name; }

  static set(email: string, password: string, name: string) {
    this._email = email;
    this._password = password;
    this._name = name;
  }

  static clear() {
    this._email = '';
    this._password = '';
    this._name = '';
  }

  static get hasCredentials() { return !!this._email; }
}
