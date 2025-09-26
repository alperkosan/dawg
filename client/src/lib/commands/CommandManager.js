// src/lib/commands/CommandManager.js

/**
 * Uygulamadaki tüm komutları yöneten, geri alma ve yineleme
 * geçmişini tutan singleton sınıfı.
 */
class CommandManager {
  constructor() {
    this.history = [];      // Geri alınabilir komutların yığını
    this.redoStack = [];    // İleri alınabilir komutların yığını
    this.maxHistorySize = 100; // Ne kadar geçmişi tutacağımız
  }

  /**
   * Yeni bir komutu çalıştırır ve geçmişe ekler.
   * @param {Command} command - Çalıştırılacak komut nesnesi.
   */
  execute(command) {
    command.execute();
    this.history.push(command);

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.redoStack = [];
    console.log(`Executed: ${command.getDescription()}`);
  }

  /**
   * Son komutu geri alır.
   */
  undo() {
    if (this.history.length === 0) {
      console.log("Geri alınacak bir işlem yok.");
      return;
    }

    const command = this.history.pop();
    command.undo();
    this.redoStack.push(command);
    console.log(`Undone: ${command.getDescription()}`);
  }

  /**
   * Geri alınmış bir komutu yeniden çalıştırır.
   */
  redo() {
    if (this.redoStack.length === 0) {
      console.log("İleri alınacak bir işlem yok.");
      return;
    }

    const command = this.redoStack.pop();
    command.execute();
    this.history.push(command);
    console.log(`Redone: ${command.getDescription()}`);
  }
}

// Projenin her yerinden aynı yöneticiye erişebilmek için tek bir örnek (instance) oluşturuyoruz.
const commandManager = new CommandManager();
export default commandManager;