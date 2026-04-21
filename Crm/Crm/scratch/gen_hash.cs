using System;
using BCrypt.Net;

class Program {
    static void Main() {
        Console.WriteLine(BCrypt.Net.BCrypt.HashPassword("CabtechDohaQatar111!@#"));
    }
}
