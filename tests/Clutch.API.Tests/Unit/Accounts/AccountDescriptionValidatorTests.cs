using Clutch.API.Domain.Accounts;

namespace Clutch.API.Tests.Unit.Accounts;

public sealed class AccountDescriptionValidatorTests
{
    [Fact]
    public void Accepts_descriptions_without_financial_identifiers()
    {
        var descriptions = new[]
        {
            "Everyday spending",
            "Holiday savings",
            "Reference 12345",
            "Merchant reference 4029357700",
            "Reference 123456",
            "Reference 1234-5678",
            "Reference 12345678901",
        };

        foreach (var description in descriptions)
        {
            Assert.True(AccountDescriptionValidator.IsValid(description));
        }
    }

    [Fact]
    public void Rejects_labelled_account_numbers_and_bsb_formats()
    {
        var descriptions = new[]
        {
            "BSB 123-456",
            "BSB 123456",
            "Account 12345678901",
        };

        foreach (var description in descriptions)
        {
            Assert.False(AccountDescriptionValidator.IsValid(description));
        }
    }

    [Fact]
    public void Rejects_recognized_and_labelled_card_numbers()
    {
        var descriptions = new[]
        {
            "Payment card 4111 1111 1111 1111",
            "Card number 1234 5678 9012 3456",
        };

        foreach (var description in descriptions)
        {
            Assert.False(AccountDescriptionValidator.IsValid(description));
        }
    }

    [Theory]
    [InlineData("4000000000000")]
    [InlineData("4000 0000 0000 0000")]
    [InlineData("4000-0000-0000-0000-000")]
    [InlineData("5100 0000 0000 0000")]
    [InlineData("5500000000000000")]
    [InlineData("2221000000000000")]
    [InlineData("2720-0000-0000-0000")]
    [InlineData("3400 000000 00000")]
    [InlineData("370000000000000")]
    public void Rejects_recognized_card_patterns_without_requiring_a_checksum(string value)
    {
        Assert.False(AccountDescriptionValidator.IsValid($"Payment {value}"));
    }

    [Theory]
    [InlineData("400000000000")]
    [InlineData("40000000000000")]
    [InlineData("5000000000000000")]
    [InlineData("5600000000000000")]
    [InlineData("2220000000000000")]
    [InlineData("2721000000000000")]
    [InlineData("350000000000000")]
    [InlineData("34000000000000")]
    [InlineData("44000000000000000")]
    public void Accepts_unlabelled_nonmatching_prefixes_and_lengths(string value)
    {
        Assert.True(AccountDescriptionValidator.IsValid($"Reference {value}"));
    }

    [Fact]
    public void Rejects_blank_and_overlong_descriptions()
    {
        Assert.False(AccountDescriptionValidator.IsValid(" "));
        Assert.False(AccountDescriptionValidator.IsValid(new string('a', 201)));
    }
}
