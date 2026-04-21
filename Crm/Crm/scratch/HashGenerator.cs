using System;
using BCrypt.Net;

namespace HashGenerator
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length < 1) return;
            string password = args[0];
            string hash = BCrypt.Net.BCrypt.HashPassword(password, 11, hashType: HashType.SHA256);
            Console.WriteLine(hash);
        }
    }
}
