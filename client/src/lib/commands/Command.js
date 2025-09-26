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
    // Önce elle atadığımız 'name' özelliğini kontrol et,
    // yoksa constructor'ın ismini kullan, o da yoksa 'Bilinmeyen komut' de.
    return this.name || this.constructor.name || 'Bilinmeyen komut';
  }
}