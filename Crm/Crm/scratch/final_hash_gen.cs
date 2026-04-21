using System;
using BCrypt.Net;

class Program {
    static void Main() {
        Console.WriteLine("Admin Hash: " + BCrypt.Net.BCrypt.HashPassword("CabtechDohaQatar111!@#"));
        Console.WriteLine("DevAdmin Hash: " + BCrypt.Net.BCrypt.HashPassword("PrajithCabtech3031@"));
    }
}
