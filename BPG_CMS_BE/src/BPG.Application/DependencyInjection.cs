using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using BPG.Application.Common.Behaviors;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace BPG.Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplication(this IServiceCollection services)
        {
            services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

            services.AddMediatR(cfg =>
            {
                cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly);
                cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
            });

            return services;
        }
    }
}
