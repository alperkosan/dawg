// src/lib/commands/Command.js

/**
 * Tüm komut nesneleri için temel arayüz (interface) görevi gören ana sınıf.
 * Her komutun bir `execute` ve bir `undo` metodu olmalıdır.
 */
export class Command {
  /**
   * Komutun ana işlemini gerçekleştirir.
   */
  execute() {
    throw new Error('Execute metodu alt sınıfta tanımlanmalıdır.');
  }

  /**
   * Komutun yaptığı işlemi geri alır.
   */
  undo() {
    throw new Error('Undo metodu alt sınıfta tanımlanmalıdır.');
  }

  /**
   * Komutun ne yaptığına dair kısa bir açıklama döndürür (opsiyonel).
   * @returns {string}
   */
  getDescription() {
    return 'Bilinmeyen komut';
  }
}