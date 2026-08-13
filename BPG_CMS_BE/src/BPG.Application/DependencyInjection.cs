using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using BPG.Application.Common.Behaviors;
using BPG.Application.Common.Authorization;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace BPG.Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplication(this IServiceCollection services)
        {
            services.AddMemoryCache();
            services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

            services.AddMediatR(cfg =>
            {
                cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly);
                cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
                cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
                cfg.AddOpenBehavior(typeof(CacheBehavior<,>));
            });

            services.AddAutoMapper(typeof(DependencyInjection).Assembly);
            services.AddScoped<BPG.Application.IServices.IProjectAccessService, ProjectAccessService>();
            services.AddScoped<BPG.Application.Features.Wbs.Services.WbsCloneFactory>();
            services.AddScoped<
                BPG.Application.IServices.IDirectPurchaseFulfillmentService,
                BPG.Application.Features.DirectPurchases.Services.DirectPurchaseFulfillmentService>();

            return services;
        }
    }
}
