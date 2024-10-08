using Matematiks;
using Matematiks.Data;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.EntityFrameworkCore;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddDbContextFactory<MatematiksDbContext>(opts =>
opts.UseSqlite("Data Source=matematiks.sqlite3"));
builder.Services.AddSingleton<IMatematiksDbContextFactory, MatematiksDbContextFactory>();

await builder.Build().RunAsync();
